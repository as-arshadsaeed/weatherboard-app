import { RequestError, requestJson } from '@/services/http'
import type { City } from '@/types/city'
import type {
  CurrentConditions,
  DailyForecast,
  OpenMeteoForecastResponse,
  WeatherReport,
} from '@/types/weather'
import { FORECAST_DAYS } from '@/utils/temperature'
import { areValidCoordinates } from '@/utils/validation'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
export const WEATHER_REQUEST_TIMEOUT_MS = 10_000

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
]

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'sunrise',
  'sunset',
]

export type WeatherErrorKind =
  | 'network'
  | 'timeout'
  | 'invalid-location'
  | 'rate-limited'
  | 'unavailable'
  | 'bad-response'

/** Messages are written for non-technical users (spec §4.3). */
const MESSAGES: Record<WeatherErrorKind, string> = {
  network: 'Unable to retrieve weather data. Check your internet connection and try again.',
  timeout: 'The weather service took too long to respond. Check your connection and try again.',
  'invalid-location': 'Weather data is unavailable for this location.',
  'rate-limited': 'The weather service is busy right now. Please wait a moment and try again.',
  unavailable: 'The weather service is temporarily unavailable. Please try again shortly.',
  'bad-response': 'Weather data could not be read for this location. Please try again.',
}

export class WeatherApiError extends Error {
  readonly kind: WeatherErrorKind

  constructor(kind: WeatherErrorKind, options?: { cause?: unknown }) {
    super(MESSAGES[kind], options)
    this.name = 'WeatherApiError'
    this.kind = kind
  }

  /** Retrying cannot help for a location the API rejected. */
  get isRetryable(): boolean {
    return this.kind !== 'invalid-location'
  }
}

export function buildForecastUrl(city: Pick<City, 'latitude' | 'longitude' | 'timezone'>): string {
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    current: CURRENT_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
    // Use the city's own timezone when known; otherwise let Open-Meteo resolve it from coordinates.
    timezone: city.timezone ?? 'auto',
    forecast_days: String(FORECAST_DAYS),
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
  })
  return `${FORECAST_URL}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Runtime validation of the API response. We never trust the network shape.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WeatherApiError('bad-response')
  }
  return value
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new WeatherApiError('bad-response')
  return value
}

function parseCurrent(raw: unknown): CurrentConditions {
  if (!isRecord(raw) || typeof raw.time !== 'string') throw new WeatherApiError('bad-response')
  return {
    time: raw.time,
    // Required: without these there is nothing meaningful to show.
    temperatureC: requireNumber(raw.temperature_2m),
    weatherCode: requireNumber(raw.weather_code),
    // Optional: a missing value degrades to "Not available" instead of failing the whole report.
    apparentTemperatureC: nullableNumber(raw.apparent_temperature),
    humidityPercent: nullableNumber(raw.relative_humidity_2m),
    windSpeedKmh: nullableNumber(raw.wind_speed_10m),
    windDirectionDegrees: nullableNumber(raw.wind_direction_10m),
    isDay: requireNumber(raw.is_day) === 1,
  }
}

function parseDaily(raw: unknown): DailyForecast[] {
  if (!isRecord(raw)) throw new WeatherApiError('bad-response')

  const dates = requireArray(raw.time)
  const codes = requireArray(raw.weather_code)
  const maxima = requireArray(raw.temperature_2m_max)
  const minima = requireArray(raw.temperature_2m_min)
  const precipitation = requireArray(raw.precipitation_probability_max)
  const sunrises = requireArray(raw.sunrise)
  const sunsets = requireArray(raw.sunset)

  if (dates.length < FORECAST_DAYS) throw new WeatherApiError('bad-response')

  return dates.slice(0, FORECAST_DAYS).map((date, index): DailyForecast => {
    if (typeof date !== 'string') throw new WeatherApiError('bad-response')
    return {
      date,
      weatherCode: requireNumber(codes[index]),
      maxTemperatureC: requireNumber(maxima[index]),
      minTemperatureC: requireNumber(minima[index]),
      precipitationProbabilityPercent: nullableNumber(precipitation[index]),
      sunrise: nullableString(sunrises[index]),
      sunset: nullableString(sunsets[index]),
    }
  })
}

export function parseForecastResponse(
  json: unknown,
  fetchedAt: number = Date.now(),
): WeatherReport {
  if (!isRecord(json) || typeof json.timezone !== 'string') {
    throw new WeatherApiError('bad-response')
  }
  const body = json as Partial<OpenMeteoForecastResponse> & Record<string, unknown>

  return {
    latitude: requireNumber(body.latitude),
    longitude: requireNumber(body.longitude),
    timezone: json.timezone,
    current: parseCurrent(body.current),
    daily: parseDaily(body.daily),
    fetchedAt,
  }
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

function statusToErrorKind(status: number | undefined): WeatherErrorKind {
  if (status === 400 || status === 404 || status === 422) return 'invalid-location'
  if (status === 429) return 'rate-limited'
  return 'unavailable'
}

function toWeatherError(error: RequestError): WeatherApiError {
  switch (error.kind) {
    case 'network':
      return new WeatherApiError('network', { cause: error })
    case 'timeout':
      return new WeatherApiError('timeout', { cause: error })
    case 'invalid-json':
      return new WeatherApiError('bad-response', { cause: error })
    case 'http-error':
      return new WeatherApiError(statusToErrorKind(error.status), { cause: error })
  }
}

export interface FetchWeatherOptions {
  /** Abort to cancel an outdated request. Aborts are re-thrown as-is, never turned into UI errors. */
  signal?: AbortSignal
  timeoutMs?: number
}

export async function fetchWeather(
  city: Pick<City, 'latitude' | 'longitude' | 'timezone'>,
  { signal, timeoutMs = WEATHER_REQUEST_TIMEOUT_MS }: FetchWeatherOptions = {},
): Promise<WeatherReport> {
  // Reject impossible coordinates before spending a network request.
  if (!areValidCoordinates(city.latitude, city.longitude)) {
    throw new WeatherApiError('invalid-location')
  }

  let json: unknown
  try {
    json = await requestJson(buildForecastUrl(city), { signal, timeoutMs })
  } catch (error) {
    throw error instanceof RequestError ? toWeatherError(error) : error
  }

  // Failed/odd payloads are never returned as weather (and so can never be cached as valid data).
  return parseForecastResponse(json)
}

/** Normalise anything thrown while loading weather into a WeatherApiError. */
export function toWeatherApiError(error: unknown): WeatherApiError {
  return error instanceof WeatherApiError
    ? error
    : new WeatherApiError('network', { cause: error })
}
