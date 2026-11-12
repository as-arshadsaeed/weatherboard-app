import { fromRequestError, CitySearchError } from '@/services/citySearchError'
import { RequestError, requestJson } from '@/services/http'
import type { City } from '@/types/city'
import { MAX_SUGGESTIONS, SEARCH_REQUEST_TIMEOUT_MS } from '@/utils/constants'
import { areValidCoordinates } from '@/utils/validation'

const GEODB_HOST = 'wft-geo-db.p.rapidapi.com'
const GEODB_URL = `https://${GEODB_HOST}/v1/geo/cities`

export function buildGeoDbUrl(query: string, limit: number = MAX_SUGGESTIONS): string {
  const params = new URLSearchParams({
    namePrefix: query,
    limit: String(limit),
    sort: '-population',
    types: 'CITY',
  })
  return `${GEODB_URL}?${params.toString()}`
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse a GeoDB /v1/geo/cities response. Items that cannot be used (no name, no usable
 * coordinates) are skipped rather than failing the whole search; a body without a `data`
 * array is rejected as a bad response.
 */
export function parseGeoDbResponse(json: unknown): City[] {
  if (!isRecord(json) || !Array.isArray(json.data)) throw new CitySearchError('bad-response')

  const cities: City[] = []
  for (const item of json.data as unknown[]) {
    if (!isRecord(item)) continue
    const name = nonEmptyString(item.name) ?? nonEmptyString(item.city)
    const { latitude, longitude } = item
    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number') continue
    if (!areValidCoordinates(latitude, longitude)) continue

    const identifier =
      typeof item.id === 'number' || typeof item.id === 'string'
        ? String(item.id)
        : (nonEmptyString(item.wikiDataId) ?? `${latitude},${longitude}`)

    cities.push({
      id: `geodb:${identifier}`,
      name,
      region: nonEmptyString(item.region),
      country: nonEmptyString(item.country),
      latitude,
      longitude,
      // GeoDB list results carry no timezone; weather resolves it from the coordinates.
    })
  }
  return cities.slice(0, MAX_SUGGESTIONS)
}

export interface GeoDbSearchOptions {
  apiKey: string
  signal?: AbortSignal
  timeoutMs?: number
}

export async function searchGeoDb(
  query: string,
  { apiKey, signal, timeoutMs = SEARCH_REQUEST_TIMEOUT_MS }: GeoDbSearchOptions,
): Promise<City[]> {
  let json: unknown
  try {
    json = await requestJson(buildGeoDbUrl(query), {
      signal,
      timeoutMs,
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': GEODB_HOST },
    })
  } catch (error) {
    throw error instanceof RequestError ? fromRequestError(error) : error
  }
  return parseGeoDbResponse(json)
}
