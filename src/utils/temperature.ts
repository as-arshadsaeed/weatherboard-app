import type { TemperatureUnit } from '@/types/weather'

export const FORECAST_DAYS = 5

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32
}

export function convertTemperature(celsius: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius
}

/** Rounded whole degrees; avoids rendering "-0". */
export function roundTemperature(celsius: number, unit: TemperatureUnit): number {
  const rounded = Math.round(convertTemperature(celsius, unit))
  return rounded === 0 ? 0 : rounded
}

export function temperatureUnitLetter(unit: TemperatureUnit): 'C' | 'F' {
  return unit === 'fahrenheit' ? 'F' : 'C'
}

/** The single place temperatures are formatted, so units are never mixed. e.g. "18°C". */
export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return `${roundTemperature(celsius, unit)}°${temperatureUnitLetter(unit)}`
}

/** Compact form without the unit letter, for places where the unit is stated elsewhere. */
export function formatDegrees(celsius: number, unit: TemperatureUnit): string {
  return `${roundTemperature(celsius, unit)}°`
}
