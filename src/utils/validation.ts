import type { City } from '@/types/city'
import type { WeatherReport } from '@/types/weather'
import { isSameCity } from '@/utils/city'

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

/** Runtime check for a City read from storage (never trust persisted data). */
export function isCity(value: unknown): value is City {
  if (typeof value !== 'object' || value === null) return false
  const city = value as Record<string, unknown>
  const optionalString = (v: unknown) => v === undefined || typeof v === 'string'
  return (
    typeof city.id === 'string' &&
    city.id !== '' &&
    typeof city.name === 'string' &&
    city.name.trim() !== '' &&
    typeof city.latitude === 'number' &&
    typeof city.longitude === 'number' &&
    areValidCoordinates(city.latitude, city.longitude) &&
    optionalString(city.region) &&
    optionalString(city.country) &&
    optionalString(city.timezone)
  )
}

/**
 * Salvage whatever is valid from a stored list: drops corrupt entries and duplicates (by identity
 * or coordinates), and keeps at most `max`. A partly corrupted list loses only its bad entries.
 */
export function sanitizeCities(value: unknown, max: number): City[] {
  if (!Array.isArray(value)) return []
  const cities: City[] = []
  for (const item of value as unknown[]) {
    if (cities.length >= max) break
    if (isCity(item) && !cities.some((existing) => isSameCity(existing, item))) cities.push(item)
  }
  return cities
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isNullableNumber = (value: unknown): boolean => value === null || isFiniteNumber(value)
const isNullableString = (value: unknown): boolean => value === null || typeof value === 'string'

/** Runtime check for a WeatherReport read back from IndexedDB (stored data is never trusted). */
export function isWeatherReport(value: unknown): value is WeatherReport {
  if (typeof value !== 'object' || value === null) return false
  const report = value as Record<string, unknown>
  const current = report.current as Record<string, unknown> | null | undefined
  if (
    !isFiniteNumber(report.latitude) ||
    !isFiniteNumber(report.longitude) ||
    typeof report.timezone !== 'string' ||
    !isFiniteNumber(report.fetchedAt) ||
    typeof current !== 'object' ||
    current === null ||
    !Array.isArray(report.daily) ||
    report.daily.length !== 5
  ) {
    return false
  }
  const currentOk =
    typeof current.time === 'string' &&
    isFiniteNumber(current.temperatureC) &&
    isFiniteNumber(current.weatherCode) &&
    typeof current.isDay === 'boolean' &&
    isNullableNumber(current.apparentTemperatureC) &&
    isNullableNumber(current.humidityPercent) &&
    isNullableNumber(current.windSpeedKmh) &&
    isNullableNumber(current.windDirectionDegrees)
  if (!currentOk) return false

  return (report.daily as unknown[]).every((day) => {
    if (typeof day !== 'object' || day === null) return false
    const d = day as Record<string, unknown>
    return (
      typeof d.date === 'string' &&
      isFiniteNumber(d.weatherCode) &&
      isFiniteNumber(d.maxTemperatureC) &&
      isFiniteNumber(d.minTemperatureC) &&
      isNullableNumber(d.precipitationProbabilityPercent) &&
      isNullableString(d.sunrise) &&
      isNullableString(d.sunset)
    )
  })
}
