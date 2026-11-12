import { useCallback, useState } from 'react'

import { getStoredValue, setStoredValue } from '@/services/storageService'
import { isTemperatureUnit } from '@/types/preferences'
import type { TemperatureUnit } from '@/types/weather'

export const UNIT_STORAGE_KEY = 'unit'
export const DEFAULT_UNIT: TemperatureUnit = 'celsius'

/**
 * The user's temperature unit, persisted in localStorage (with the shared in-memory fallback when
 * storage is unavailable). Changing it only changes how stored °C values are displayed: weather is
 * always fetched in Celsius, so switching units never triggers a network request.
 */
export function useUnits() {
  const [unit, setUnitState] = useState<TemperatureUnit>(() =>
    getStoredValue(UNIT_STORAGE_KEY, isTemperatureUnit, DEFAULT_UNIT),
  )

  const setUnit = useCallback((next: TemperatureUnit) => {
    setUnitState(next)
    setStoredValue(UNIT_STORAGE_KEY, next)
  }, [])

  return { unit, setUnit }
}
