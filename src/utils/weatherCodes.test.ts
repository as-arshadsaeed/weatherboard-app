import { describe, expect, it } from 'vitest'

import { describeWeather } from '@/utils/weatherCodes'

describe('describeWeather', () => {
  it.each([
    [0, 'Clear sky'],
    [2, 'Partly cloudy'],
    [3, 'Overcast'],
    [45, 'Fog'],
    [53, 'Moderate drizzle'],
    [65, 'Heavy rain'],
    [75, 'Heavy snow'],
    [82, 'Violent rain showers'],
    [95, 'Thunderstorm'],
    [99, 'Thunderstorm with heavy hail'],
  ])('maps WMO code %i to "%s"', (code, label) => {
    expect(describeWeather(code).label).toBe(label)
  })

  it('uses moon variants at night for clear and partly cloudy skies', () => {
    expect(describeWeather(0, true).icon).toBe('sun')
    expect(describeWeather(0, false).icon).toBe('moon')
    expect(describeWeather(2, true).icon).toBe('cloud-sun')
    expect(describeWeather(2, false).icon).toBe('cloud-moon')
  })

  it('uses the night tone for clear nights, but not for rain', () => {
    expect(describeWeather(0, false).tone).toBe('night')
    expect(describeWeather(61, false).tone).toBe('rain')
  })

  it('degrades gracefully for codes it does not know', () => {
    expect(describeWeather(1234)).toEqual({
      label: 'Unknown conditions',
      icon: 'cloud',
      tone: 'cloud',
    })
  })

  it('gives every documented WMO code a non-empty description', () => {
    const documented = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]
    for (const code of documented) {
      expect(describeWeather(code).label, `code ${code}`).not.toBe('Unknown conditions')
    }
  })
})
