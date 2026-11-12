/**
 * TEST-ONLY Open-Meteo response used to drive the browser tests deterministically.
 * (Network interception happens in tests; the application itself contains no mock data.)
 */
export function forecastBody() {
  return {
    latitude: 51.51,
    longitude: -0.13,
    timezone: 'Europe/London',
    current: {
      time: '2026-11-12T17:45',
      temperature_2m: 6.7,
      relative_humidity_2m: 64,
      apparent_temperature: 2.9,
      is_day: 0,
      weather_code: 2,
      wind_speed_10m: 11.9,
      wind_direction_10m: 358,
    },
    daily: {
      time: ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'],
      weather_code: [3, 0, 61, 51, 95],
      temperature_2m_max: [8.4, 7.2, 9.3, 12.8, 9.2],
      temperature_2m_min: [4.7, 2.4, 0.1, 4.8, -0.4],
      precipitation_probability_max: [0, 0, 82, 40, 90],
      sunrise: ['2026-11-12T07:13', '2026-11-13T07:15', '2026-11-14T07:16', '2026-11-15T07:18', '2026-11-16T07:20'],
      sunset: ['2026-11-12T16:15', '2026-11-13T16:13', '2026-11-14T16:12', '2026-11-15T16:11', '2026-11-16T16:09'],
    },
  }
}

export const API_GLOB = '**/api.open-meteo.com/v1/forecast*'
export const LONDON_URL = '/?lat=51.5072&lon=-0.1276&name=London&country=United%20Kingdom&region=England'
