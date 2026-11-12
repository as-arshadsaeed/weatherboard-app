import { useCallback, useState } from 'react'

import { getStoredValue, setStoredValue } from '@/services/storageService'
import type { City } from '@/types/city'
import { isCity, parseCityFromSearch } from '@/utils/validation'

export const SELECTED_CITY_STORAGE_KEY = 'selectedCity'

/**
 * The city whose weather is shown. Initial value: a location in the URL (?lat=&lon=, a deep link),
 * else the city the user last selected, else none. Selecting a city persists it so a reload shows it again.
 */
export function useSelectedCity() {
  const [city, setCity] = useState<City | null>(
    () =>
      parseCityFromSearch(window.location.search) ??
      getStoredValue(SELECTED_CITY_STORAGE_KEY, isCity),
  )

  const selectCity = useCallback((next: City) => {
    setCity(next)
    setStoredValue(SELECTED_CITY_STORAGE_KEY, next)
  }, [])

  return { city, selectCity }
}
