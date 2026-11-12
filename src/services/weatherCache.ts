import type { City } from '@/types/city'
import type { WeatherReport } from '@/types/weather'
import { isSameCity } from '@/utils/city'
import { isCity, isWeatherReport } from '@/utils/validation'

/**
 * Offline weather snapshots in IndexedDB.
 *
 * Keeps the most recent successful forecast for the last MAX_SNAPSHOTS cities viewed, each with the
 * time it was retrieved, so the app can show it when offline and say exactly how old it is.
 *
 * - Only successful, validated responses are ever saved; errors and malformed data never are.
 * - Entries expire after SNAPSHOT_MAX_AGE_MS and the oldest are dropped beyond MAX_SNAPSHOTS.
 * - Stored data is validated on read; corrupt entries are deleted, never shown.
 * - Every function is safe to call when IndexedDB is unavailable or fails: it returns null / does
 *   nothing and never throws, so weather keeps working online without offline support.
 * - A service worker update never touches this database (it is separate from the worker's caches).
 */

const DB_NAME = 'weatherboard'
const DB_VERSION = 1
const STORE = 'weather-snapshots'

export const MAX_SNAPSHOTS = 10
export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface SnapshotRecord {
  key: string
  city: City
  report: WeatherReport
  /** When the report was retrieved (epoch ms). */
  savedAt: number
}

export interface WeatherSnapshot {
  city: City
  report: WeatherReport
  /** When the report was retrieved (epoch ms). */
  savedAt: number
}

function isSnapshotRecord(value: unknown): value is SnapshotRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.key === 'string' &&
    typeof record.savedAt === 'number' &&
    Number.isFinite(record.savedAt) &&
    isCity(record.city) &&
    isWeatherReport(record.report)
  )
}

let databasePromise: Promise<IDBDatabase | null> | null = null

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise

  const attempt = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      return resolve(null)
    }
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      // Let another tab upgrade the schema, or the browser reclaim the connection, without blocking.
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      database.onclose = () => {
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

  databasePromise = attempt
  // A failed attempt must not be cached: forget it so a later call can try again. (Doing this inside
  // the executor would be overwritten by the assignment above when the failure is synchronous.)
  void attempt.then((database) => {
    if (database === null && databasePromise === attempt) databasePromise = null
  })
  return attempt
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Run `work` in one transaction. Resolves null if IndexedDB is unavailable or anything fails. */
async function inTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T | null> {
  try {
    const database = await openDatabase()
    if (!database) return null
    const transaction = database.transaction(STORE, mode)
    const finished = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    const result = await work(transaction.objectStore(STORE))
    await finished
    return result
  } catch {
    return null
  }
}

interface Entry {
  key: IDBValidKey
  value: unknown
}

async function readAll(store: IDBObjectStore): Promise<Entry[]> {
  const [keys, values] = await Promise.all([toPromise(store.getAllKeys()), toPromise(store.getAll())])
  return keys.map((key, index) => ({ key, value: values[index] }))
}

/**
 * Save a successful report as the latest snapshot for `city`. The same place found through another
 * provider replaces its entry. Also removes expired and corrupt entries and trims to MAX_SNAPSHOTS.
 */
export async function saveWeatherSnapshot(city: City, report: WeatherReport): Promise<void> {
  // Defence in depth: refuse to persist anything that would not pass validation when read back.
  if (!isCity(city) || !isWeatherReport(report)) return

  await inTransaction('readwrite', async (store) => {
    const now = Date.now()
    const entries = await readAll(store)

    let existingKey: IDBValidKey | undefined
    const keep: Array<{ key: IDBValidKey; savedAt: number }> = []
    for (const { key, value } of entries) {
      if (!isSnapshotRecord(value) || now - value.savedAt > SNAPSHOT_MAX_AGE_MS) {
        store.delete(key)
      } else if (isSameCity(value.city, city)) {
        existingKey = key
      } else {
        keep.push({ key, savedAt: value.savedAt })
      }
    }

    const record: SnapshotRecord = {
      key: typeof existingKey === 'string' ? existingKey : city.id,
      city,
      report,
      savedAt: report.fetchedAt,
    }
    store.put(record)

    // Keep the newest MAX_SNAPSHOTS - 1 others alongside the one just saved.
    keep
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(MAX_SNAPSHOTS - 1)
      .forEach(({ key }) => store.delete(key))
  })
}

/**
 * The saved report for `city`, or null if there is none, it has expired, or it is unreadable.
 * Never claims data for a city that was not saved.
 */
export async function loadWeatherSnapshot(city: Pick<City, 'id' | 'latitude' | 'longitude'>): Promise<WeatherSnapshot | null> {
  const found = await inTransaction('readwrite', async (store) => {
    const now = Date.now()
    let match: SnapshotRecord | null = null
    for (const { key, value } of await readAll(store)) {
      if (!isSnapshotRecord(value) || now - value.savedAt > SNAPSHOT_MAX_AGE_MS) {
        store.delete(key) // corrupt or expired: remove rather than ever display it
      } else if (match === null && isSameCity(value.city, city)) {
        match = value
      }
    }
    return match
  })
  return found ? { city: found.city, report: found.report, savedAt: found.savedAt } : null
}

/** Test helper: drop the cached connection (the database itself is replaced by the test). */
export function resetWeatherCacheForTests(): void {
  databasePromise?.then((database) => database?.close()).catch(() => {})
  databasePromise = null
}
