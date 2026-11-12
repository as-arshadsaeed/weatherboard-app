/**
 * TEST-ONLY builders for geocoding API responses (shapes verified against the live
 * Open-Meteo geocoding API; GeoDB shape follows its documentation).
 */

export function openMeteoResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 2643743,
    name: 'London',
    latitude: 51.50853,
    longitude: -0.12574,
    elevation: 25,
    feature_code: 'PPLC',
    country_code: 'GB',
    timezone: 'Europe/London',
    population: 8961989,
    country: 'United Kingdom',
    admin1: 'England',
    ...overrides,
  }
}

export function openMeteoResponse(results: Array<Record<string, unknown>> | undefined) {
  return results === undefined
    ? { generationtime_ms: 0.05 }
    : { results, generationtime_ms: 0.05 }
}

export function geoDbItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 126693,
    wikiDataId: 'Q84',
    type: 'CITY',
    city: 'London',
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'England',
    regionCode: 'ENG',
    latitude: 51.5085,
    longitude: -0.1257,
    population: 8961989,
    ...overrides,
  }
}

export function geoDbResponse(items: Array<Record<string, unknown>>) {
  return { data: items, metadata: { currentOffset: 0, totalCount: items.length } }
}
