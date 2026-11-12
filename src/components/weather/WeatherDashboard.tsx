import { CurrentWeather } from '@/components/weather/CurrentWeather'
import { FiveDayForecast } from '@/components/weather/FiveDayForecast'
import { WeatherAttribution } from '@/components/weather/WeatherAttribution'
import { WeatherError } from '@/components/weather/WeatherError'
import { WeatherSkeleton } from '@/components/weather/WeatherSkeleton'
import { useWeather } from '@/hooks/useWeather'
import type { City } from '@/types/city'
import type { TemperatureUnit } from '@/types/weather'

interface WeatherDashboardProps {
  city: City
  unit: TemperatureUnit
}

/** Loads and shows weather for one city: loading, success and error states. */
export function WeatherDashboard({ city, unit }: WeatherDashboardProps) {
  const { state, retry } = useWeather(city)

  switch (state.status) {
    case 'idle':
    case 'loading':
      return <WeatherSkeleton city={city} />
    case 'error':
      return <WeatherError city={city} error={state.error} onRetry={retry} />
    case 'success':
      return (
        <div className="space-y-6">
          <CurrentWeather city={city} report={state.report} unit={unit} />
          <FiveDayForecast days={state.report.daily} unit={unit} />
          <WeatherAttribution />
        </div>
      )
  }
}
