/** Normalised weather models used by the UI. Temperatures are always Celsius; wind is km/h. */

export interface CurrentConditions {
  /** Observation time in the location's local time, e.g. "2026-11-12T17:45". */
  time: string
  temperatureC: number
  apparentTemperatureC: number
  humidityPercent: number
  windSpeedKmh: number
  windDirectionDegrees: number
  weatherCode: number
  isDay: boolean
}

export interface DailyForecast {
  /** Calendar date at the location, "YYYY-MM-DD". */
  date: string
  weatherCode: number
  maxTemperatureC: number
  minTemperatureC: number
  /** Null when the forecast model provides no precipitation probability for the location. */
  precipitationProbabilityPercent: number | null
  /** Local ISO time, or null when the sun does not rise/set that day (polar regions). */
  sunrise: string | null
  sunset: string | null
}

export interface WeatherReport {
  latitude: number
  longitude: number
  /** IANA timezone the times in this report are expressed in. */
  timezone: string
  current: CurrentConditions
  /** Five calendar days, starting with today at the location. */
  daily: DailyForecast[]
  /** Epoch milliseconds when the data was retrieved. */
  fetchedAt: number
}

export type TemperatureUnit = 'celsius' | 'fahrenheit'

/** Raw Open-Meteo /v1/forecast response (only the fields we request). */
export interface OpenMeteoForecastResponse {
  latitude: number
  longitude: number
  timezone: string
  current: {
    time: string
    temperature_2m: number | null
    relative_humidity_2m: number | null
    apparent_temperature: number | null
    is_day: number | null
    weather_code: number | null
    wind_speed_10m: number | null
    wind_direction_10m: number | null
  }
  daily: {
    time: string[]
    weather_code: Array<number | null>
    temperature_2m_max: Array<number | null>
    temperature_2m_min: Array<number | null>
    precipitation_probability_max: Array<number | null>
    sunrise: Array<string | null>
    sunset: Array<string | null>
  }
}
