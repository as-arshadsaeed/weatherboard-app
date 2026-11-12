import { describe, expect, it } from 'vitest'

import type { WeatherState } from '@/hooks/useWeather'
import { WeatherApiError } from '@/services/weatherApi'
import { london } from '@/test/cities'
import { buildReport } from '@/test/fixtures/report'
import { describeWeatherForAnnouncement } from '@/utils/announcements'

const report = buildReport(1_700_000_000_000, 6.7)

describe('describeWeatherForAnnouncement', () => {
  it('announces fresh weather with the city, condition and temperature in the selected unit', () => {
    const state: WeatherState = { status: 'success', report }
    expect(describeWeatherForAnnouncement(london, state, 'celsius')).toBe('Weather for London: Partly cloudy, 7°C.')
    expect(describeWeatherForAnnouncement(london, state, 'fahrenheit')).toBe('Weather for London: Partly cloudy, 44°F.')
  })

  it('says saved weather is saved, without a relative time that would change on its own', () => {
    const state: WeatherState = { status: 'cached', report, cachedAt: 1, reason: 'offline', refreshing: false }
    const text = describeWeatherForAnnouncement(london, state, 'celsius')
    expect(text).toBe('Showing saved weather for London: Partly cloudy, 7°C.')
    expect(text).not.toMatch(/ago/)
  })

  it.each<[string, WeatherState]>([
    ['idle', { status: 'idle' }],
    ['loading', { status: 'loading' }],
    ['error', { status: 'error', error: new WeatherApiError('network') }],
  ])('is silent while %s (those states announce themselves)', (_label, state) => {
    expect(describeWeatherForAnnouncement(london, state, 'celsius')).toBe('')
  })
})
