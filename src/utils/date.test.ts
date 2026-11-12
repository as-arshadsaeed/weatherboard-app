import { describe, expect, it } from 'vitest'

import {
  formatClockFromIso,
  formatForecastDay,
  formatForecastDayLong,
  formatForecastShortDate,
  formatLocalDate,
  formatLocalTime,
} from '@/utils/date'

describe('date utilities', () => {
  // 17:45 UTC on 12 Nov 2026 is 02:45 on Friday 13 Nov in Tokyo (UTC+9).
  const instant = new Date('2026-11-12T17:45:00Z')

  it('formats date and time in the city timezone, not the device timezone', () => {
    expect(formatLocalTime(instant, 'Asia/Tokyo')).toMatch(/02:45/)
    expect(formatLocalDate(instant, 'Asia/Tokyo')).toMatch(/Friday/)
    expect(formatLocalDate(instant, 'Asia/Tokyo')).toMatch(/13/)
    expect(formatLocalTime(instant, 'America/New_York')).toMatch(/12:45/)
  })

  it('falls back instead of throwing for an unknown timezone', () => {
    expect(() => formatLocalTime(instant, 'Not/AZone')).not.toThrow()
  })

  it('labels the first forecast day "Today" and others by weekday', () => {
    expect(formatForecastDay('2026-11-12', 0)).toBe('Today')
    expect(formatForecastDay('2026-11-13', 1)).toBe('Fri')
    expect(formatForecastDayLong('2026-11-13', 1)).toBe('Friday 13 November')
    expect(formatForecastDayLong('2026-11-12', 0)).toBe('Today, Thursday 12 November')
    expect(formatForecastShortDate('2026-11-13')).toBe('13 Nov')
  })

  it('extracts the clock time from a local ISO string', () => {
    expect(formatClockFromIso('2026-11-12T07:13')).toBe('07:13')
    expect(formatClockFromIso(null)).toBeNull()
    expect(formatClockFromIso('')).toBeNull()
  })
})
