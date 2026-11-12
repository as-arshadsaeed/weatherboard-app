import { toCitySearchError } from '@/services/citySearchError'
import { searchGeoDb } from '@/services/geoDbApi'
import { searchOpenMeteoGeocoding } from '@/services/openMeteoGeocodingApi'
import type { City } from '@/types/city'
import { MIN_SEARCH_LENGTH } from '@/utils/constants'
import { getGeoDbApiKey } from '@/utils/env'
import { normalizeSearchQuery } from '@/utils/validation'

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 50

interface CacheEntry {
  cities: City[]
  storedAt: number
}

/** Recent successful searches only; errors are never cached. Insertion order doubles as LRU order. */
const cache = new Map<string, CacheEntry>()

function readCache(key: string): City[] | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  // Refresh recency.
  cache.delete(key)
  cache.set(key, entry)
  return entry.cities
}

function writeCache(key: string, cities: City[]): void {
  cache.delete(key)
  cache.set(key, { cities, storedAt: Date.now() })
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function clearCitySearchCache(): void {
  cache.clear()
}

export interface SearchCitiesOptions {
  signal?: AbortSignal
}

/**
 * Search cities by name.
 *
 * Uses GeoDB when a key is configured and falls back to the keyless Open-Meteo geocoding API
 * when GeoDB is unavailable (network error, timeout, rate limit, outage, bad data) or no key is
 * set. A GeoDB response that is simply empty is authoritative and is not retried elsewhere.
 */
export async function searchCities(
  rawQuery: string,
  { signal }: SearchCitiesOptions = {},
): Promise<City[]> {
  const query = normalizeSearchQuery(rawQuery)
  if (query.length < MIN_SEARCH_LENGTH) return []

  const cacheKey = query.toLowerCase()
  const cached = readCache(cacheKey)
  if (cached) return cached

  const apiKey = getGeoDbApiKey()
  let cities: City[]

  if (apiKey) {
    try {
      cities = await searchGeoDb(query, { apiKey, signal })
    } catch (error) {
      if (signal?.aborted) throw error
      cities = await searchFallback(query, signal)
    }
  } else {
    cities = await searchFallback(query, signal)
  }

  writeCache(cacheKey, cities)
  return cities
}

async function searchFallback(query: string, signal: AbortSignal | undefined): Promise<City[]> {
  try {
    return await searchOpenMeteoGeocoding(query, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw toCitySearchError(error)
  }
}
