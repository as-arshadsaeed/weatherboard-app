import { describe, expect, it } from 'vitest'

import {
  celsiusToFahrenheit,
  convertTemperature,
  formatDegrees,
  formatTemperature,
  roundTemperature,
} from '@/utils/temperature'

describe('temperature utilities', () => {
  it('converts Celsius to Fahrenheit', () => {
    expect(celsiusToFahrenheit(0)).toBe(32)
    expect(celsiusToFahrenheit(100)).toBe(212)
    expect(celsiusToFahrenheit(-40)).toBe(-40)
  })

  it('leaves Celsius untouched', () => {
    expect(convertTemperature(21.5, 'celsius')).toBe(21.5)
  })

  it('rounds to whole degrees', () => {
    expect(roundTemperature(6.7, 'celsius')).toBe(7)
    expect(roundTemperature(21.5, 'fahrenheit')).toBe(71)
  })

  it('never renders negative zero', () => {
    expect(roundTemperature(-0.4, 'celsius')).toBe(0)
    expect(formatTemperature(-0.4, 'celsius')).toBe('0°C')
  })

  it('formats with a consistent unit', () => {
    expect(formatTemperature(18, 'celsius')).toBe('18°C')
    expect(formatTemperature(18, 'fahrenheit')).toBe('64°F')
    expect(formatDegrees(18, 'fahrenheit')).toBe('64°')
    expect(formatTemperature(-5.6, 'celsius')).toBe('-6°C')
  })
})
