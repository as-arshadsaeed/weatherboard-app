import type { City } from '@/types/city'

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

export function areValidCoordinates(latitude: number, longitude: number): boolean {
  return isValidLatitude(latitude) && isValidLongitude(longitude)
}

/** Human-readable coordinates, e.g. "51.51°N, 0.13°W". */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`
  return `${lat}, ${lon}`
}

/**
 * Temporary entry point until city search exists (Phase 3): read a location from
 * `?lat=&lon=&name=&country=&region=&tz=`. Returns null when no coordinates are supplied.
 * Coordinates are NOT range-checked here: out-of-range or non-numeric values flow to the
 * weather service, which reports them through the normal "unavailable for this location" error.
 */
export function parseCityFromSearch(search: string): City | null {
  const params = new URLSearchParams(search)
  const rawLat = params.get('lat')
  const rawLon = params.get('lon')
  if (rawLat === null || rawLon === null) return null

  const latitude = rawLat.trim() === '' ? NaN : Number(rawLat)
  const longitude = rawLon.trim() === '' ? NaN : Number(rawLon)
  const name = params.get('name')?.trim()
  const timezone = params.get('tz')?.trim()

  return {
    id: `${rawLat},${rawLon}`,
    name: name || (areValidCoordinates(latitude, longitude) ? formatCoordinates(latitude, longitude) : 'Selected location'),
    region: params.get('region')?.trim() || undefined,
    country: params.get('country')?.trim() || undefined,
    latitude,
    longitude,
    timezone: timezone || undefined,
  }
}

/** Trim and collapse internal whitespace so "  new   york " and "new york" are the same search. */
export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}
