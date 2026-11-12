import { CitySearchError, fromRequestError } from '@/services/citySearchError'
import { RequestError, requestJson } from '@/services/http'
import type { City } from '@/types/city'
import { MAX_SUGGESTIONS, SEARCH_REQUEST_TIMEOUT_MS } from '@/utils/constants'
import { areValidCoordinates } from '@/utils/validation'

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

/** Ask for extra candidates: the API's own ranking is fuzzy, so we re-rank by population. */
const CANDIDATE_COUNT = 10

export function buildGeocodingUrl(query: string): string {
  const params = new URLSearchParams({
    name: query,
    count: String(CANDIDATE_COUNT),
    language: 'en',
    format: 'json',
  })
  return `${GEOCODING_URL}?${params.toString()}`
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Open-Meteo omits `results` entirely when nothing matches, which is a valid empty result. */
export function parseGeocodingResponse(json: unknown): City[] {
  if (!isRecord(json)) throw new CitySearchError('bad-response')
  if (json.results === undefined) return []
  if (!Array.isArray(json.results)) throw new CitySearchError('bad-response')

  const seen = new Set<string>()
  const candidates: Array<{ city: City; population: number }> = []

  for (const item of json.results as unknown[]) {
    if (!isRecord(item)) continue
    const name = nonEmptyString(item.name)
    const { latitude, longitude } = item
    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number') continue
    if (!areValidCoordinates(latitude, longitude)) continue

    const id = `open-meteo:${typeof item.id === 'number' ? item.id : `${latitude},${longitude}`}`
    if (seen.has(id)) continue
    seen.add(id)

    candidates.push({
      city: {
        id,
        name,
        region: nonEmptyString(item.admin1),
        country: nonEmptyString(item.country),
        latitude,
        longitude,
        timezone: nonEmptyString(item.timezone),
      },
      population: typeof item.population === 'number' ? item.population : 0,
    })
  }

  return candidates
    .sort((a, b) => b.population - a.population)
    .slice(0, MAX_SUGGESTIONS)
    .map((candidate) => candidate.city)
}

export interface GeocodingSearchOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export async function searchOpenMeteoGeocoding(
  query: string,
  { signal, timeoutMs = SEARCH_REQUEST_TIMEOUT_MS }: GeocodingSearchOptions = {},
): Promise<City[]> {
  let json: unknown
  try {
    json = await requestJson(buildGeocodingUrl(query), { signal, timeoutMs })
  } catch (error) {
    throw error instanceof RequestError ? fromRequestError(error) : error
  }
  return parseGeocodingResponse(json)
}
