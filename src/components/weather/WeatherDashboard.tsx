import type { ReactNode } from 'react'

import { CachedWeatherNotice } from '@/components/weather/CachedWeatherNotice'
import { CurrentWeather } from '@/components/weather/CurrentWeather'
import { FiveDayForecast } from '@/components/weather/FiveDayForecast'
import { WeatherAttribution } from '@/components/weather/WeatherAttribution'
import { WeatherDetails } from '@/components/weather/WeatherDetails'
import { WeatherError } from '@/components/weather/WeatherError'
import { WeatherSkeleton } from '@/components/weather/WeatherSkeleton'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useWeather } from '@/hooks/useWeather'
import type { City } from '@/types/city'
import type { TemperatureUnit, WeatherReport } from '@/types/weather'

interface WeatherDashboardProps {
  city: City
  unit: TemperatureUnit
  /** Rendered inside the current-weather card (e.g. the favourite button). */
  action?: ReactNode
}

function WeatherContent({
  city,
  report,
  unit,
  action,
  notice,
}: {
  city: City
  report: WeatherReport
  unit: TemperatureUnit
  action?: ReactNode
  notice?: ReactNode
}) {
  return (
    <div className="space-y-6">
      {notice}
      <CurrentWeather city={city} report={report} unit={unit} action={action} />
      <WeatherDetails report={report} />
      <FiveDayForecast days={report.daily} unit={unit} />
      <WeatherAttribution />
    </div>
  )
}

/**
 * Loads and shows weather for one city: loading, success, saved-while-offline and error states.
 * Saved weather is always labelled with its age; it is never shown as if it were live.
 */
export function WeatherDashboard({ city, unit, action }: WeatherDashboardProps) {
  const online = useOnlineStatus()
  const { state, retry } = useWeather(city, online)

  switch (state.status) {
    case 'idle':
    case 'loading':
      return <WeatherSkeleton city={city} reserveAction={action !== undefined} />
    case 'error':
      return <WeatherError city={city} error={state.error} onRetry={retry} />
    case 'success':
      return <WeatherContent city={city} report={state.report} unit={unit} action={action} />
    case 'cached':
      return (
        <WeatherContent
          city={city}
          report={state.report}
          unit={unit}
          action={action}
          notice={
            <CachedWeatherNotice
              cachedAt={state.cachedAt}
              reason={state.reason}
              refreshing={state.refreshing}
              onRetry={retry}
            />
          }
        />
      )
  }
}
