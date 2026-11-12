import { useCallback, useState } from 'react'

import { getStoredValue, setStoredValue } from '@/services/storageService'
import type { City } from '@/types/city'
import { isSameCity } from '@/utils/city'
import { MAX_FAVOURITES } from '@/utils/constants'
import { sanitizeCities } from '@/utils/validation'

export const FAVOURITES_STORAGE_KEY = 'favourites'

export type AddFavouriteResult = 'added' | 'duplicate' | 'full'

const isArray = (value: unknown): value is unknown[] => Array.isArray(value)

/**
 * Up to MAX_FAVOURITES saved cities, persisted in localStorage.
 *
 * - Duplicates are detected by id *or* coordinates, so the same city from two geocoding providers
 *   is still one favourite.
 * - Stored data is validated on load; a partly corrupted list keeps its valid entries.
 * - If storage is unavailable, favourites still work for the session (in memory) and the shared
 *   storage status drives the "will not persist" notice.
 */
export function useFavourites() {
  const [favourites, setFavourites] = useState<City[]>(() =>
    sanitizeCities(getStoredValue(FAVOURITES_STORAGE_KEY, isArray, []), MAX_FAVOURITES),
  )

  const save = useCallback((next: City[]) => {
    setFavourites(next)
    setStoredValue(FAVOURITES_STORAGE_KEY, next)
  }, [])

  const isFavourite = useCallback(
    (city: Pick<City, 'id' | 'latitude' | 'longitude'>) =>
      favourites.some((favourite) => isSameCity(favourite, city)),
    [favourites],
  )

  const add = useCallback(
    (city: City): AddFavouriteResult => {
      if (favourites.some((favourite) => isSameCity(favourite, city))) return 'duplicate'
      if (favourites.length >= MAX_FAVOURITES) return 'full'
      save([...favourites, city])
      return 'added'
    },
    [favourites, save],
  )

  const remove = useCallback(
    (city: Pick<City, 'id' | 'latitude' | 'longitude'>) => {
      save(favourites.filter((favourite) => !isSameCity(favourite, city)))
    },
    [favourites, save],
  )

  return { favourites, isFavourite, isFull: favourites.length >= MAX_FAVOURITES, add, remove }
}
