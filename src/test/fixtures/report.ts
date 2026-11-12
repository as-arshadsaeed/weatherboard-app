import { parseForecastResponse } from '@/services/weatherApi'
import { buildForecastResponse } from '@/test/fixtures/openMeteo'
import type { WeatherReport } from '@/types/weather'

/** TEST-ONLY: a valid WeatherReport (built through the real parser) retrieved at `fetchedAt`. */
export function buildReport(fetchedAt: number = Date.now(), tempC = 6.7): WeatherReport {
  const body = buildForecastResponse()
  body.current.temperature_2m = tempC
  return parseForecastResponse(body, fetchedAt)
}
