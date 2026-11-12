import { useCallback, useEffect, useState } from 'react'

import { fetchWeather, toWeatherApiError, type WeatherApiError } from '@/services/weatherApi'
import type { City } from '@/types/city'
import type { WeatherReport } from '@/types/weather'

export type WeatherState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; report: WeatherReport }
  | { status: 'error'; error: WeatherApiError }

type Settled = { key: string; report: WeatherReport } | { key: string; error: WeatherApiError }

/**
 * Loads weather for a city.
 *
 * - Outdated requests are aborted when the city changes or the component unmounts.
 * - A result only counts if its key matches the current request, so a late response for a
 *   previous city can never overwrite the current one (no race conditions).
 * - Status is derived from the request key rather than set synchronously in the effect.
 */
export function useWeather(city: City | null) {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)

  const latitude = city?.latitude
  const longitude = city?.longitude
  const timezone = city?.timezone
  const requestKey =
    latitude === undefined || longitude === undefined
      ? null
      : `${latitude},${longitude},${timezone ?? ''}#${attempt}`

  useEffect(() => {
    if (requestKey === null || latitude === undefined || longitude === undefined) return

    const controller = new AbortController()
    fetchWeather({ latitude, longitude, timezone }, { signal: controller.signal })
      .then((report) => {
        // A superseded request must never write its result, even if it resolved anyway.
        if (controller.signal.aborted) return
        setSettled({ key: requestKey, report })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSettled({ key: requestKey, error: toWeatherApiError(error) })
      })

    return () => controller.abort()
  }, [requestKey, latitude, longitude, timezone])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  let state: WeatherState
  if (requestKey === null) state = { status: 'idle' }
  else if (settled?.key !== requestKey) state = { status: 'loading' }
  else if ('error' in settled) state = { status: 'error', error: settled.error }
  else state = { status: 'success', report: settled.report }

  return { state, retry }
}
