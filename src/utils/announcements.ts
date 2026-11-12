import type { WeatherState } from '@/hooks/useWeather'
import type { City } from '@/types/city'
import type { TemperatureUnit } from '@/types/weather'
import { formatTemperature } from '@/utils/temperature'
import { describeWeather } from '@/utils/weatherCodes'

/**
 * What a screen reader is told when weather arrives or its unit changes. The skeleton and error states
 * announce themselves, so this is empty for them. It deliberately leaves out relative times ("3 hours
 * ago"), which would change on their own and be re-announced for no reason.
 */
export function describeWeatherForAnnouncement(city: City, state: WeatherState, unit: TemperatureUnit): string {
  if (state.status !== 'success' && state.status !== 'cached') return ''
  const { current } = state.report
  const summary = `${describeWeather(current.weatherCode, current.isDay).label}, ${formatTemperature(current.temperatureC, unit)}`
  return state.status === 'success'
    ? `Weather for ${city.name}: ${summary}.`
    : `Showing saved weather for ${city.name}: ${summary}.`
}
