import { useCallback, useEffect, useState } from 'react'

import { searchCities } from '@/services/citySearch'
import { toCitySearchError, type CitySearchError } from '@/services/citySearchError'
import type { City } from '@/types/city'
import { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from '@/utils/constants'
import { normalizeSearchQuery } from '@/utils/validation'

/** `query` is the (normalised) text the state describes; it can lag the input while the user types. */
export type CitySearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; results: City[] }
  | { status: 'error'; query: string; error: CitySearchError }

type Settled =
  | { key: string; results: City[] }
  | { key: string; error: CitySearchError }

/**
 * Debounced, cancellable city search.
 *
 * - Nothing is requested until the input has at least MIN_SEARCH_LENGTH characters.
 * - Requests start SEARCH_DEBOUNCE_MS after the user pauses typing.
 * - An outdated request is aborted, and a result only counts if its key matches the current
 *   request, so overlapping searches cannot race.
 * - While the user types, the previous state stays visible (its `query` tells consumers it is stale).
 */
export function useCitySearch(input: string) {
  const query = normalizeSearchQuery(input)
  const [debounced, setDebounced] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query])

  const target = debounced.length >= MIN_SEARCH_LENGTH ? debounced : null
  const requestKey = target === null ? null : `${target}#${attempt}`

  useEffect(() => {
    if (requestKey === null || target === null) return

    const controller = new AbortController()
    searchCities(target, { signal: controller.signal })
      .then((results) => {
        // A superseded request must never write its result, even if it resolved anyway.
        if (controller.signal.aborted) return
        setSettled({ key: requestKey, results })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSettled({ key: requestKey, error: toCitySearchError(error) })
      })

    return () => controller.abort()
  }, [requestKey, target])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  let state: CitySearchState
  if (query.length < MIN_SEARCH_LENGTH) {
    state = { status: 'idle' }
  } else if (target === null) {
    state = { status: 'loading', query }
  } else if (settled?.key === requestKey) {
    state =
      'error' in settled
        ? { status: 'error', query: target, error: settled.error }
        : { status: 'success', query: target, results: settled.results }
  } else {
    state = { status: 'loading', query: target }
  }

  return { state, query, retry }
}
