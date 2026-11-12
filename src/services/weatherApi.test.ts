import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import {
  buildForecastUrl,
  fetchWeather,
  parseForecastResponse,
  WeatherApiError,
} from '@/services/weatherApi'

const London = { latitude: 51.5072, longitude: -0.1276 }
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the promise to reject')
}

describe('buildForecastUrl', () => {
  it('requests every required current and daily field, 5 days, in Celsius and km/h', () => {
    const url = new URL(buildForecastUrl(London))
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('latitude')).toBe('51.5072')
    expect(url.searchParams.get('longitude')).toBe('-0.1276')
    expect(url.searchParams.get('forecast_days')).toBe('5')
    expect(url.searchParams.get('temperature_unit')).toBe('celsius')
    expect(url.searchParams.get('wind_speed_unit')).toBe('kmh')
    expect(url.searchParams.get('current')?.split(',')).toEqual(
      expect.arrayContaining([
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'wind_speed_10m',
        'wind_direction_10m',
        'weather_code',
        'is_day',
      ]),
    )
    expect(url.searchParams.get('daily')?.split(',')).toEqual(
      expect.arrayContaining([
        'temperature_2m_max',
        'temperature_2m_min',
        'weather_code',
        'precipitation_probability_max',
        'sunrise',
        'sunset',
      ]),
    )
  })

  it("uses the city's timezone when known, otherwise lets Open-Meteo resolve it", () => {
    expect(new URL(buildForecastUrl({ ...London, timezone: 'Europe/London' })).searchParams.get('timezone')).toBe('Europe/London')
    expect(new URL(buildForecastUrl(London)).searchParams.get('timezone')).toBe('auto')
  })
})

describe('fetchWeather: success', () => {
  it('returns a typed report with current conditions and five days', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    const report = await fetchWeather(London)

    expect(report.timezone).toBe('Europe/London')
    expect(report.current).toEqual({
      time: '2026-11-12T17:45',
      temperatureC: 6.7,
      apparentTemperatureC: 2.9,
      humidityPercent: 64,
      windSpeedKmh: 11.9,
      windDirectionDegrees: 358,
      weatherCode: 2,
      isDay: false,
    })
    expect(report.daily).toHaveLength(5)
    expect(report.daily[0]).toMatchObject({
      date: '2026-11-12',
      weatherCode: 3,
      maxTemperatureC: 8.4,
      minTemperatureC: 4.7,
      precipitationProbabilityPercent: 0,
      sunrise: '2026-11-12T07:13',
      sunset: '2026-11-12T16:15',
    })
    expect(report.fetchedAt).toBeGreaterThan(0)
  })

  it('keeps a missing precipitation probability as null instead of inventing 0%', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    const report = await fetchWeather(London)
    expect(report.daily[4]?.precipitationProbabilityPercent).toBeNull()
  })

  it('treats empty sunrise/sunset (polar day or night) as null', async () => {
    const body = buildForecastResponse()
    body.daily.sunrise = ['', '', '', '', '']
    fetchMock.mockResolvedValue(jsonResponse(body))
    const report = await fetchWeather(London)
    expect(report.daily[0]?.sunrise).toBeNull()
  })

  it('passes the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    await fetchWeather(London, { signal: new AbortController().signal })
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('fetchWeather: failures', () => {
  it('rejects invalid coordinates without making a request', async () => {
    const error = await errorOf(fetchWeather({ latitude: 999, longitude: 0 }))
    expect(error).toBeInstanceOf(WeatherApiError)
    expect(error).toMatchObject({
      kind: 'invalid-location',
      message: 'Weather data is unavailable for this location.',
      isRetryable: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects NaN coordinates without making a request', async () => {
    await expect(fetchWeather({ latitude: NaN, longitude: NaN })).rejects.toMatchObject({
      kind: 'invalid-location',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a network failure with a plain-language message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await errorOf(fetchWeather(London))
    expect(error).toMatchObject({
      kind: 'network',
      message: 'Unable to retrieve weather data. Check your internet connection and try again.',
      isRetryable: true,
    })
  })

  it('maps HTTP 400 from the API to an invalid-location error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: true, reason: 'Latitude must be in range' }, { status: 400 }),
    )
    await expect(fetchWeather(London)).rejects.toMatchObject({ kind: 'invalid-location' })
  })

  it('maps HTTP 429 to a rate-limited error', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }))
    await expect(fetchWeather(London)).rejects.toMatchObject({ kind: 'rate-limited' })
  })

  it.each([500, 502, 503])('maps HTTP %i to a temporary-unavailable error', async (status) => {
    fetchMock.mockResolvedValue(new Response('', { status }))
    await expect(fetchWeather(London)).rejects.toMatchObject({
      kind: 'unavailable',
      isRetryable: true,
    })
  })

  it('times out when the service does not respond', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    const error = await errorOf(fetchWeather(London, { timeoutMs: 20 }))
    expect(error).toMatchObject({ kind: 'timeout' })
  })

  it('re-throws caller aborts as-is so they are never shown as errors', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    const controller = new AbortController()
    const pending = errorOf(fetchWeather(London, { signal: controller.signal }))
    controller.abort()
    const error = await pending
    expect(error).not.toBeInstanceOf(WeatherApiError)
    expect(controller.signal.aborted).toBe(true)
  })

  it('rejects a body that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 200 }))
    await expect(fetchWeather(London)).rejects.toMatchObject({ kind: 'bad-response' })
  })
})

describe('parseForecastResponse: malformed data is never returned as weather', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['missing timezone', { ...buildForecastResponse(), timezone: undefined }],
    ['missing current', { ...buildForecastResponse(), current: undefined }],
    ['missing daily', { ...buildForecastResponse(), daily: undefined }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseForecastResponse(body)).toThrow(WeatherApiError)
  })

  it('rejects a null current temperature', () => {
    const body = buildForecastResponse()
    body.current.temperature_2m = null
    expect(() => parseForecastResponse(body)).toThrow(expect.objectContaining({ kind: 'bad-response' }))
  })

  it('rejects fewer than five forecast days', () => {
    const body = buildForecastResponse()
    body.daily.time = body.daily.time.slice(0, 3)
    expect(() => parseForecastResponse(body)).toThrow(expect.objectContaining({ kind: 'bad-response' }))
  })

  it('rejects a daily array with a missing temperature', () => {
    const body = buildForecastResponse()
    body.daily.temperature_2m_max[2] = null
    expect(() => parseForecastResponse(body)).toThrow(expect.objectContaining({ kind: 'bad-response' }))
  })
})

describe('missing optional current values degrade instead of failing the report', () => {
  it.each([
    ['apparent_temperature', 'apparentTemperatureC'],
    ['relative_humidity_2m', 'humidityPercent'],
    ['wind_speed_10m', 'windSpeedKmh'],
    ['wind_direction_10m', 'windDirectionDegrees'],
  ] as const)('a null %s becomes null in the report', (field, key) => {
    const body = buildForecastResponse()
    body.current[field] = null
    const report = parseForecastResponse(body)
    expect(report.current[key]).toBeNull()
    expect(report.current.temperatureC).toBe(6.7) // the rest is intact
  })

  it('treats an absent field the same as null', () => {
    const body = buildForecastResponse()
    delete (body.current as Partial<typeof body.current>).relative_humidity_2m
    expect(parseForecastResponse(body).current.humidityPercent).toBeNull()
  })

  it('still rejects a missing condition code or temperature (nothing meaningful to show)', () => {
    const noCode = buildForecastResponse()
    noCode.current.weather_code = null
    expect(() => parseForecastResponse(noCode)).toThrow(WeatherApiError)
    const noTemp = buildForecastResponse()
    noTemp.current.temperature_2m = null
    expect(() => parseForecastResponse(noTemp)).toThrow(WeatherApiError)
  })
})
