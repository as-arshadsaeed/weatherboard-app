import type { City } from '@/types/city'

/** "Region, Country" for display under a city name (either part may be missing). */
export function formatLocation(city: Pick<City, 'region' | 'country'>): string {
  return [city.region, city.country].filter(Boolean).join(', ')
}

/** Full label for an input or announcement, e.g. "London, England, United Kingdom". */
export function formatCityLabel(city: Pick<City, 'name' | 'region' | 'country'>): string {
  return [city.name, formatLocation(city)].filter(Boolean).join(', ')
}
