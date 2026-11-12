import type { City } from '@/types/city'

/** "Region, Country" for display under a city name (either part may be missing). */
export function formatLocation(city: Pick<City, 'region' | 'country'>): string {
  return [city.region, city.country].filter(Boolean).join(', ')
}

/** Full label for an input or announcement, e.g. "London, England, United Kingdom". */
export function formatCityLabel(city: Pick<City, 'name' | 'region' | 'country'>): string {
  return [city.name, formatLocation(city)].filter(Boolean).join(', ')
}

/**
 * Two geocoding providers give the same city different ids and slightly different coordinates, so
 * identity is "same id, or the same place within ~2 km". This is what prevents duplicate favourites.
 */
const SAME_PLACE_TOLERANCE_DEGREES = 0.02

export function isSameCity(
  a: Pick<City, 'id' | 'latitude' | 'longitude'>,
  b: Pick<City, 'id' | 'latitude' | 'longitude'>,
): boolean {
  return (
    a.id === b.id ||
    (Math.abs(a.latitude - b.latitude) <= SAME_PLACE_TOLERANCE_DEGREES &&
      Math.abs(a.longitude - b.longitude) <= SAME_PLACE_TOLERANCE_DEGREES)
  )
}
