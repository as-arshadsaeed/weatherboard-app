import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CitySearchError } from '@/services/citySearchError'
import { buildGeoDbUrl, parseGeoDbResponse, searchGeoDb } from '@/services/geoDbApi'
import {
  buildGeocodingUrl,
  parseGeocodingResponse,
  searchOpenMeteoGeocoding,
} from '@/services/openMeteoGeocodingApi'
import {
  geoDbItem,
  geoDbResponse,
  openMeteoResponse,
  openMeteoResult,
} from '@/test/fixtures/geocoding'
import { jsonResponse } from '@/test/fixtures/openMeteo'

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the promise to reject')
}

describe('GeoDB', () => {
  it('builds a request limited to 6 results, sorted by population', () => {
    const url = new URL(buildGeoDbUrl('lon'))
    expect(url.host).toBe('wft-geo-db.p.rapidapi.com')
    expect(url.pathname).toBe('/v1/geo/cities')
    expect(url.searchParams.get('namePrefix')).toBe('lon')
    expect(url.searchParams.get('limit')).toBe('6')
    expect(url.searchParams.get('sort')).toBe('-population')
  })

  it('encodes unusual input safely', () => {
    const url = new URL(buildGeoDbUrl('São Paulo & co'))
    expect(url.searchParams.get('namePrefix')).toBe('São Paulo & co')
  })

  it('sends the RapidAPI key and host headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geoDbResponse([geoDbItem()])))
    await searchGeoDb('lon', { apiKey: 'test-key' })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.headers).toEqual({
      'X-RapidAPI-Key': 'test-key',
      'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com',
    })
  })

  it('maps results to cities with city, region and country', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geoDbResponse([geoDbItem()])))
    const [london] = await searchGeoDb('lon', { apiKey: 'k' })
    expect(london).toEqual({
      id: 'geodb:126693',
      name: 'London',
      region: 'England',
      country: 'United Kingdom',
      latitude: 51.5085,
      longitude: -0.1257,
    })
  })

  it('falls back to the `city` field and the wikiDataId when `name`/`id` are absent', () => {
    const [c] = parseGeoDbResponse(
      geoDbResponse([geoDbItem({ name: undefined, id: undefined, wikiDataId: 'Q84' })]),
    )
    expect(c).toMatchObject({ name: 'London', id: 'geodb:Q84' })
  })

  it('skips unusable items instead of failing the whole search', () => {
    const cities = parseGeoDbResponse(
      geoDbResponse([
        geoDbItem(),
        geoDbItem({ name: undefined, city: undefined }),
        geoDbItem({ latitude: 'x' }),
        geoDbItem({ latitude: 999 }),
        null as unknown as Record<string, unknown>,
      ]),
    )
    expect(cities).toHaveLength(1)
  })

  it('never returns more than 6 suggestions', () => {
    const items = Array.from({ length: 10 }, (_, i) => geoDbItem({ id: i, name: `City ${i}` }))
    expect(parseGeoDbResponse(geoDbResponse(items))).toHaveLength(6)
  })

  it('treats an empty data array as "no results"', () => {
    expect(parseGeoDbResponse(geoDbResponse([]))).toEqual([])
  })

  it.each([null, [], { hello: 'world' }, { data: 'nope' }])('rejects malformed body %j', (body) => {
    expect(() => parseGeoDbResponse(body)).toThrow(CitySearchError)
  })

  it.each([
    [429, 'rate-limited'],
    [403, 'unavailable'],
    [500, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    fetchMock.mockResolvedValue(new Response('', { status }))
    expect(await errorOf(searchGeoDb('lon', { apiKey: 'k' }))).toMatchObject({ kind })
  })

  it('maps a network failure to a clear message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await errorOf(searchGeoDb('lon', { apiKey: 'k' }))).toMatchObject({
      kind: 'network',
      message: 'Unable to search cities. Check your internet connection and try again.',
    })
  })
})

describe('Open-Meteo geocoding', () => {
  it('builds a keyless request', () => {
    const url = new URL(buildGeocodingUrl('lon'))
    expect(url.host).toBe('geocoding-api.open-meteo.com')
    expect(url.searchParams.get('name')).toBe('lon')
    expect(url.searchParams.get('language')).toBe('en')
  })

  it('maps results including the timezone', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoResponse([openMeteoResult()])))
    const [london] = await searchOpenMeteoGeocoding('lon')
    expect(london).toEqual({
      id: 'open-meteo:2643743',
      name: 'London',
      region: 'England',
      country: 'United Kingdom',
      latitude: 51.50853,
      longitude: -0.12574,
      timezone: 'Europe/London',
    })
  })

  it('treats a missing `results` key as "no results", not an error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openMeteoResponse(undefined)))
    expect(await searchOpenMeteoGeocoding('zzqxjkw')).toEqual([])
  })

  it('ranks by population and returns at most 6', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      openMeteoResult({ id: i, name: `Town ${i}`, population: i * 100 }),
    )
    const cities = parseGeocodingResponse(openMeteoResponse(results))
    expect(cities).toHaveLength(6)
    expect(cities.map((c) => c.name)).toEqual(['Town 9', 'Town 8', 'Town 7', 'Town 6', 'Town 5', 'Town 4'])
  })

  it('puts the larger London ahead of a small place that the API ranked first', () => {
    const cities = parseGeocodingResponse(
      openMeteoResponse([
        openMeteoResult({ id: 1, name: 'Loni', population: 516082 }),
        openMeteoResult({ id: 2, name: 'London', population: 8961989 }),
      ]),
    )
    expect(cities[0]?.name).toBe('London')
  })

  it('removes duplicate ids and unusable items', () => {
    const cities = parseGeocodingResponse(
      openMeteoResponse([
        openMeteoResult(),
        openMeteoResult(),
        openMeteoResult({ id: 5, latitude: 'x' }),
        openMeteoResult({ id: 6, name: '' }),
      ]),
    )
    expect(cities).toHaveLength(1)
  })

  it.each([null, [], { results: 'nope' }])('rejects malformed body %j', (body) => {
    expect(() => parseGeocodingResponse(body)).toThrow(CitySearchError)
  })

  it('reports HTTP errors and timeouts with specific messages', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }))
    expect(await errorOf(searchOpenMeteoGeocoding('lon'))).toMatchObject({
      kind: 'unavailable',
      message: 'City search is temporarily unavailable. Please try again.',
    })

    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(init.signal?.reason))),
    )
    expect(await errorOf(searchOpenMeteoGeocoding('lon', { timeoutMs: 20 }))).toMatchObject({
      kind: 'timeout',
    })
  })

  it('re-throws caller aborts as-is', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(init.signal?.reason))),
    )
    const controller = new AbortController()
    const pending = errorOf(searchOpenMeteoGeocoding('lon', { signal: controller.signal }))
    controller.abort()
    expect(await pending).not.toBeInstanceOf(CitySearchError)
  })
})
