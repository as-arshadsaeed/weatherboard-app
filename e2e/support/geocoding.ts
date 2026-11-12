/** TEST-ONLY geocoding payloads for intercepted network responses. */

export const GEODB_GLOB = '**/wft-geo-db.p.rapidapi.com/**'
export const GEOCODING_GLOB = '**/geocoding-api.open-meteo.com/**'

export function geoDbCity(id: number, name: string, region: string, country: string, lat: number, lon: number) {
  return {
    id,
    wikiDataId: `Q${id}`,
    type: 'CITY',
    city: name,
    name,
    country,
    countryCode: 'XX',
    region,
    regionCode: 'XX',
    latitude: lat,
    longitude: lon,
    population: 1_000_000 - id,
  }
}

export const LONDON = geoDbCity(1, 'London', 'England', 'United Kingdom', 51.5085, -0.1257)
export const LONDON_CA = geoDbCity(2, 'London', 'Ontario', 'Canada', 42.9834, -81.233)
export const LONDRINA = geoDbCity(3, 'Londrina', 'Paraná', 'Brazil', -23.3103, -51.1628)

export function geoDbBody(items: unknown[]) {
  return { data: items, metadata: { currentOffset: 0, totalCount: items.length } }
}

export function openMeteoGeocodingBody(items: Array<{ id: number; name: string; admin1: string; country: string; latitude: number; longitude: number; timezone: string }>) {
  return {
    results: items.map((i) => ({ ...i, population: 1_000_000 - i.id, country_code: 'XX' })),
    generationtime_ms: 0.1,
  }
}
