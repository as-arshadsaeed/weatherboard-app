import type { City } from '@/types/city'

/** "Region, Country" for display under a city name (either part may be missing). */
export function formatLocation(city: Pick<City, 'region' | 'country'>): string {
  return [city.region, city.country].filter(Boolean).join(', ')
}
