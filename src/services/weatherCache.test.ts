import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadWeatherSnapshot,
  MAX_SNAPSHOTS,
  resetWeatherCacheForTests,
  saveWeatherSnapshot,
  SNAPSHOT_MAX_AGE_MS,
} from '@/services/weatherCache'
import { berlin, london, londonFromOtherProvider, paris, tokyo } from '@/test/cities'
import { buildReport } from '@/test/fixtures/report'
import type { City } from '@/types/city'

const NOW = new Date('2026-11-12T18:00:00Z').getTime()

/** Direct access to the underlying store, to plant corrupt data and inspect what was kept. */
async function rawStore<T>(work: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('weatherboard', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('weather-snapshots', { keyPath: 'key' })
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  const tx = db.transaction('weather-snapshots', 'readwrite')
  const result = await work(tx.objectStore('weather-snapshots'))
  await new Promise((r) => (tx.oncomplete = r))
  db.close()
  return result
}
const rawAll = () =>
  rawStore(
    (store) =>
      new Promise<unknown[]>((resolve) => {
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result)
      }),
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('saving and loading', () => {
  it('returns nothing when nothing was saved', async () => {
    expect(await loadWeatherSnapshot(london)).toBeNull()
  })

  it('round-trips a snapshot with the time it was retrieved', async () => {
    const report = buildReport(NOW - 5 * 60_000)
    await saveWeatherSnapshot(london, report)
    const snapshot = await loadWeatherSnapshot(london)
    expect(snapshot?.report).toEqual(report)
    expect(snapshot?.city).toEqual(london)
    expect(snapshot?.savedAt).toBe(NOW - 5 * 60_000)
  })

  it('survives a reload: a fresh connection still reads it', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW))
    resetWeatherCacheForTests() // drops the cached connection, like a page reload
    expect((await loadWeatherSnapshot(london))?.report.current.temperatureC).toBe(6.7)
  })

  it('never claims weather for a city that was not saved', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW))
    expect(await loadWeatherSnapshot(paris)).toBeNull()
    expect(await loadWeatherSnapshot(tokyo)).toBeNull()
  })

  it('keeps each city separate', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW, 7))
    await saveWeatherSnapshot(paris, buildReport(NOW, 12))
    expect((await loadWeatherSnapshot(london))?.report.current.temperatureC).toBe(7)
    expect((await loadWeatherSnapshot(paris))?.report.current.temperatureC).toBe(12)
  })

  it('a newer successful fetch replaces the older snapshot for the same city', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW - 3_600_000, 7))
    await saveWeatherSnapshot(london, buildReport(NOW, 9))
    const snapshot = await loadWeatherSnapshot(london)
    expect(snapshot?.report.current.temperatureC).toBe(9)
    expect(snapshot?.savedAt).toBe(NOW)
    expect(await rawAll()).toHaveLength(1)
  })

  it('recognises the same place found through another provider (one entry, found either way)', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW - 60_000, 7))
    await saveWeatherSnapshot(londonFromOtherProvider, buildReport(NOW, 9))
    expect(await rawAll()).toHaveLength(1)
    expect((await loadWeatherSnapshot(london))?.report.current.temperatureC).toBe(9)
    expect((await loadWeatherSnapshot(londonFromOtherProvider))?.report.current.temperatureC).toBe(9)
  })
})

describe('refusing to save bad data', () => {
  it('does not save a malformed report', async () => {
    await saveWeatherSnapshot(london, { ...buildReport(NOW), daily: [] })
    await saveWeatherSnapshot(london, { nope: true } as never)
    expect(await loadWeatherSnapshot(london)).toBeNull()
  })

  it('does not save for an invalid city', async () => {
    await saveWeatherSnapshot({ id: 'x', name: 'Bad', latitude: 999, longitude: 0 }, buildReport(NOW))
    expect(await rawAll()).toEqual([])
  })
})

describe('expiry and size limits', () => {
  it('drops a snapshot older than 7 days instead of showing it', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW - SNAPSHOT_MAX_AGE_MS + 60_000))
    expect(await loadWeatherSnapshot(london)).not.toBeNull() // just inside the limit

    vi.setSystemTime(NOW + 120_000) // now just past it
    expect(await loadWeatherSnapshot(london)).toBeNull()
    expect(await rawAll()).toEqual([]) // and it was deleted
  })

  it('keeps at most 10 cities, dropping the least recently saved', async () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
      const city: City = { id: `c${i}`, name: `City ${i}`, latitude: i * 5, longitude: i * 5 }
      await saveWeatherSnapshot(city, buildReport(NOW - (MAX_SNAPSHOTS + 3 - i) * 60_000))
    }
    const kept = (await rawAll()) as Array<{ city: City }>
    expect(kept).toHaveLength(MAX_SNAPSHOTS)
    const names = kept.map((r) => r.city.name)
    expect(names).not.toContain('City 0') // oldest three are gone
    expect(names).not.toContain('City 2')
    expect(names).toContain('City 12') // newest kept
  })

  it('removes other expired entries whenever something new is saved', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW - SNAPSHOT_MAX_AGE_MS + 1000))
    vi.setSystemTime(NOW + 5000)
    await saveWeatherSnapshot(paris, buildReport(NOW + 5000))
    const kept = (await rawAll()) as Array<{ city: City }>
    expect(kept.map((r) => r.city.name)).toEqual(['Paris'])
  })
})

describe('corrupted storage', () => {
  it('deletes and ignores entries that fail validation', async () => {
    await saveWeatherSnapshot(london, buildReport(NOW))
    await rawStore((store) => {
      store.put({ key: 'garbage', nope: true })
      store.put({ key: 'bad-report', city: berlin, report: { current: 5 }, savedAt: NOW })
      store.put({ key: 'bad-city', city: { id: 'x' }, report: buildReport(NOW), savedAt: NOW })
      store.put({ key: 'bad-time', city: paris, report: buildReport(NOW), savedAt: 'yesterday' })
    })

    expect((await loadWeatherSnapshot(london))?.report.current.temperatureC).toBe(6.7) // the good one survives
    expect(await loadWeatherSnapshot(berlin)).toBeNull()
    expect(await loadWeatherSnapshot(paris)).toBeNull()
    expect((await rawAll()) as unknown[]).toHaveLength(1) // all four bad entries were removed
  })
})

describe('when IndexedDB is unavailable or failing', () => {
  it('does nothing and never throws if there is no IndexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(saveWeatherSnapshot(london, buildReport(NOW))).resolves.toBeUndefined()
    await expect(loadWeatherSnapshot(london)).resolves.toBeNull()
    vi.unstubAllGlobals()
  })

  it('does nothing and never throws if opening the database throws', async () => {
    const factory = new IDBFactory()
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    globalThis.indexedDB = factory
    await expect(saveWeatherSnapshot(london, buildReport(NOW))).resolves.toBeUndefined()
    await expect(loadWeatherSnapshot(london)).resolves.toBeNull()
  })

  it('does nothing and never throws if opening the database reports an error', async () => {
    const factory = new IDBFactory()
    vi.spyOn(factory, 'open').mockImplementation(() => {
      const request = {} as IDBOpenDBRequest
      queueMicrotask(() => request.onerror?.(new Event('error')))
      return request
    })
    globalThis.indexedDB = factory
    await expect(loadWeatherSnapshot(london)).resolves.toBeNull()
  })

  it('recovers on a later attempt once IndexedDB works again', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await saveWeatherSnapshot(london, buildReport(NOW))
    vi.unstubAllGlobals()
    globalThis.indexedDB = new IDBFactory()

    await saveWeatherSnapshot(london, buildReport(NOW))
    expect(await loadWeatherSnapshot(london)).not.toBeNull()
  })
})
