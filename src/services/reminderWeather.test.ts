import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadReminderWeather } from '@/services/reminderWeather'
import { loadWeatherSnapshot, saveWeatherSnapshot } from '@/services/weatherCache'
import { london } from '@/test/cities'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import { buildReport } from '@/test/fixtures/report'

let fetchMock: ReturnType<typeof vi.fn>
function setOnLine(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

beforeEach(() => {
  setOnLine(true)
  fetchMock = vi.fn(() => Promise.resolve(jsonResponse(buildForecastResponse())))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('loadReminderWeather', () => {
  it('uses a fresh forecast when it can fetch one, and saves it', async () => {
    const weather = await loadReminderWeather(london)
    expect(weather?.source).toBe('live')
    expect(weather?.report.current.temperatureC).toBe(6.7)
    await vi.waitFor(async () => expect(await loadWeatherSnapshot(london)).not.toBeNull())
  })

  it('falls back to the saved forecast when the service cannot be reached', async () => {
    await saveWeatherSnapshot(london, buildReport(Date.now(), 4.2))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const weather = await loadReminderWeather(london)
    expect(weather?.source).toBe('saved')
    expect(weather?.report.current.temperatureC).toBe(4.2)
  })

  it('goes straight to the saved forecast when offline, without trying the network', async () => {
    await saveWeatherSnapshot(london, buildReport(Date.now(), 4.2))
    setOnLine(false)
    const weather = await loadReminderWeather(london)
    expect(weather?.source).toBe('saved')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null — never invents weather — when it can neither fetch nor find a saved forecast', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await loadReminderWeather(london)).toBeNull()
    setOnLine(false)
    expect(await loadReminderWeather(london)).toBeNull()
  })

  it('never throws, even for an invalid location', async () => {
    await expect(loadReminderWeather({ id: 'x', name: 'Nowhere', latitude: 999, longitude: 0 })).resolves.toBeNull()
  })
})
