import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearCitySearchCache, searchCities } from '@/services/citySearch'
import { CitySearchError } from '@/services/citySearchError'
import {
  geoDbItem,
  geoDbResponse,
  openMeteoResponse,
  openMeteoResult,
} from '@/test/fixtures/geocoding'
import { jsonResponse } from '@/test/fixtures/openMeteo'

let fetchMock: ReturnType<typeof vi.fn>
const hosts = () => fetchMock.mock.calls.map((c) => new URL(String(c[0])).host)

beforeEach(() => {
  clearCitySearchCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_GEODB_API_KEY', '')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('searchCities: provider selection', () => {
  it('uses only the keyless Open-Meteo geocoding when no GeoDB key is configured', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoResponse([openMeteoResult()])))
    const cities = await searchCities('london')
    expect(cities).toHaveLength(1)
    expect(hosts()).toEqual(['geocoding-api.open-meteo.com'])
  })

  it('treats a whitespace-only key as not configured', async () => {
    vi.stubEnv('VITE_GEODB_API_KEY', '   ')
    fetchMock.mockResolvedValue(jsonResponse(openMeteoResponse([openMeteoResult()])))
    await searchCities('london')
    expect(hosts()).toEqual(['geocoding-api.open-meteo.com'])
  })

  it('uses GeoDB first when a key is configured', async () => {
    vi.stubEnv('VITE_GEODB_API_KEY', 'test-key')
    fetchMock.mockResolvedValue(jsonResponse(geoDbResponse([geoDbItem()])))
    const cities = await searchCities('london')
    expect(cities[0]?.id).toBe('geodb:126693')
    expect(hosts()).toEqual(['wft-geo-db.p.rapidapi.com'])
  })

  it('does not fall back when GeoDB legitimately returns no cities', async () => {
    vi.stubEnv('VITE_GEODB_API_KEY', 'test-key')
    fetchMock.mockResolvedValue(jsonResponse(geoDbResponse([])))
    expect(await searchCities('zzqxjkw')).toEqual([])
    expect(hosts()).toEqual(['wft-geo-db.p.rapidapi.com'])
  })
})

describe('searchCities: fallback when GeoDB is unavailable', () => {
  beforeEach(() => vi.stubEnv('VITE_GEODB_API_KEY', 'test-key'))

  const fallbackBody = () => jsonResponse(openMeteoResponse([openMeteoResult()]))

  it.each([
    ['rate limit (429)', () => new Response('', { status: 429 })],
    ['forbidden (403)', () => new Response('', { status: 403 })],
    ['outage (503)', () => new Response('', { status: 503 })],
    ['malformed body', () => jsonResponse({ nope: true })],
  ])('falls back on %s', async (_label, geoDbReply) => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(new URL(url).host === 'wft-geo-db.p.rapidapi.com' ? geoDbReply() : fallbackBody()),
    )
    const cities = await searchCities('london')
    expect(cities[0]?.id).toBe('open-meteo:2643743')
    expect(hosts()).toEqual(['wft-geo-db.p.rapidapi.com', 'geocoding-api.open-meteo.com'])
  })

  it('falls back when GeoDB is unreachable', async () => {
    fetchMock.mockImplementation((url: string) =>
      new URL(url).host === 'wft-geo-db.p.rapidapi.com'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(fallbackBody()),
    )
    expect(await searchCities('london')).toHaveLength(1)
  })

  it('reports the failure when both providers fail', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await searchCities('london').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CitySearchError)
    expect(error).toMatchObject({ kind: 'network' })
  })

  it('does not fall back when the caller aborted', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(init.signal?.reason))),
    )
    const pending = searchCities('london', { signal: controller.signal }).catch((e: unknown) => e)
    controller.abort()
    expect(await pending).not.toBeInstanceOf(CitySearchError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('searchCities: input handling', () => {
  it('makes no request for queries shorter than 2 characters', async () => {
    expect(await searchCities('')).toEqual([])
    expect(await searchCities(' l ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalises whitespace in the query', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoResponse([openMeteoResult()])))
    await searchCities('  new    york ')
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('name')).toBe('new york')
  })
})

describe('searchCities: cache', () => {
  // A fresh Response per call: a body can only be read once.
  beforeEach(() => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(openMeteoResponse([openMeteoResult()]))),
    )
  })

  it('serves repeated searches (any case/spacing) without another request', async () => {
    await searchCities('London')
    await searchCities('  london ')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches empty results too', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(openMeteoResponse(undefined))))
    await searchCities('zzqxjkw')
    await searchCities('zzqxjkw')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never caches failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(searchCities('london')).rejects.toBeInstanceOf(CitySearchError)
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(openMeteoResponse([openMeteoResult()]))),
    )
    expect(await searchCities('london')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('expires entries after 10 minutes', async () => {
    vi.useFakeTimers()
    await searchCities('london')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    await searchCities('london')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('evicts the least recently used entry beyond 50 searches', async () => {
    for (let i = 0; i < 51; i++) await searchCities(`city${i}`)
    expect(fetchMock).toHaveBeenCalledTimes(51)
    await searchCities('city50') // still cached
    expect(fetchMock).toHaveBeenCalledTimes(51)
    await searchCities('city0') // evicted, refetched
    expect(fetchMock).toHaveBeenCalledTimes(52)
  })
})
