import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchWeather, toWeatherApiError, WeatherApiError } from '@/services/weatherApi'
import { loadWeatherSnapshot, saveWeatherSnapshot } from '@/services/weatherCache'
import type { City } from '@/types/city'
import type { WeatherReport } from '@/types/weather'
import { areValidCoordinates } from '@/utils/validation'

/** Why saved weather is being shown instead of a fresh forecast. */
export type CachedReason = 'offline' | 'unreachable'

export type WeatherState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; report: WeatherReport }
  | {
      status: 'cached'
      report: WeatherReport
      /** When this report was retrieved (epoch ms). */
      cachedAt: number
      reason: CachedReason
      /** True while a fresh forecast is being fetched in the background. */
      refreshing: boolean
    }
  | { status: 'error'; error: WeatherApiError }

type Outcome =
  | { kind: 'fresh'; report: WeatherReport }
  | { kind: 'cached'; report: WeatherReport; cachedAt: number; reason: CachedReason }
  | { kind: 'error'; error: WeatherApiError }

interface Settled {
  cityKey: string
  key: string
  outcome: Outcome
}

async function savedOutcome(city: City, reason: CachedReason, fallback: WeatherApiError): Promise<Outcome> {
  const snapshot = await loadWeatherSnapshot(city)
  return snapshot
    ? { kind: 'cached', report: snapshot.report, cachedAt: snapshot.savedAt, reason }
    : { kind: 'error', error: fallback }
}

function toState(outcome: Outcome, refreshing: boolean): WeatherState {
  switch (outcome.kind) {
    case 'fresh':
      return { status: 'success', report: outcome.report }
    case 'cached':
      return { status: 'cached', report: outcome.report, cachedAt: outcome.cachedAt, reason: outcome.reason, refreshing }
    case 'error':
      return { status: 'error', error: outcome.error }
  }
}

/**
 * Loads weather for a city, falling back to the last saved forecast when it cannot be fetched.
 *
 * - Online: fetch; every successful response is saved to IndexedDB (failures never are).
 * - Offline, or the service cannot be reached: show the saved forecast for *this* city, marked as
 *   saved (with its age) — or, if there is none, say so. Nothing is invented for unsaved cities.
 * - Reconnecting re-fetches and replaces the saved data; the saved view stays on screen meanwhile.
 * - Outdated requests are aborted and a result only counts if its key matches the current request,
 *   so overlapping requests cannot race. Status is derived, never set synchronously in the effect.
 */
export function useWeather(city: City | null, online: boolean = true) {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)

  const latitude = city?.latitude
  const longitude = city?.longitude
  const timezone = city?.timezone
  const id = city?.id
  const name = city?.name
  const region = city?.region
  const country = city?.country

  // Rebuilt only when a field changes, so an equivalent city object never triggers a refetch.
  const target = useMemo<City | null>(
    () =>
      id === undefined || name === undefined || latitude === undefined || longitude === undefined
        ? null
        : { id, name, region, country, latitude, longitude, timezone },
    [id, name, region, country, latitude, longitude, timezone],
  )

  const cityKey = target === null ? null : `${target.latitude},${target.longitude},${target.timezone ?? ''}`
  const requestKey = cityKey === null ? null : `${cityKey}#${attempt}@${online ? 'on' : 'off'}`

  useEffect(() => {
    if (target === null || cityKey === null || requestKey === null) return

    const controller = new AbortController()
    const { signal } = controller

    const run = async (): Promise<Outcome> => {
      if (!areValidCoordinates(target.latitude, target.longitude)) {
        return { kind: 'error', error: new WeatherApiError('invalid-location') }
      }
      if (!online) {
        return savedOutcome(target, 'offline', new WeatherApiError('offline'))
      }
      try {
        const report = await fetchWeather(target, { signal })
        // Fire and forget: saving must never slow down or break showing fresh weather.
        void saveWeatherSnapshot(target, report)
        return { kind: 'fresh', report }
      } catch (error) {
        if (signal.aborted) throw error
        const apiError = toWeatherApiError(error)
        // An invalid location will not be fixed by older data; anything else (network, timeout,
        // rate limit, outage, bad response) falls back to what we saved earlier.
        return apiError.kind === 'invalid-location'
          ? { kind: 'error', error: apiError }
          : savedOutcome(target, 'unreachable', apiError)
      }
    }

    run()
      .then((outcome) => {
        // A superseded request must never write its result, even if it resolved anyway.
        if (!signal.aborted) setSettled({ cityKey, key: requestKey, outcome })
      })
      .catch(() => {
        // Only aborted requests reach here; nothing to show for them.
      })

    return () => controller.abort()
  }, [target, cityKey, requestKey, online])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  let state: WeatherState
  if (requestKey === null) {
    state = { status: 'idle' }
  } else if (settled?.key === requestKey) {
    state = toState(settled.outcome, false)
  } else if (settled?.cityKey === cityKey && settled.outcome.kind !== 'error') {
    // Same city, new request (connection changed, or a retry): keep showing what we have while it updates.
    state = toState(settled.outcome, true)
  } else {
    state = { status: 'loading' }
  }

  return { state, retry }
}
