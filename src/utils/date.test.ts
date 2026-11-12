import { describe, expect, it } from 'vitest'

import {
  formatLocalClock,
  formatForecastDay,
  formatForecastDayLong,
  formatForecastShortDate,
  formatLocalDate,
  formatLocalTime,
  formatSavedAt,
} from '@/utils/date'

describe('date utilities', () => {
  // 17:45 UTC on 12 Nov 2026 is 02:45 on Friday 13 Nov in Tokyo (UTC+9).
  const instant = new Date('2026-11-12T17:45:00Z')

  it('formats date and time in the city timezone, not the device timezone', () => {
    expect(formatLocalTime(instant, 'Asia/Tokyo')).toMatch(/\b0?2:45/)
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

  it('formats the wall-clock time of a local ISO string without timezone shifting', () => {
    expect(formatLocalClock('2026-11-12T07:13')).toMatch(/^0?7:13/)
    expect(formatLocalClock('2026-11-12T16:15')).toMatch(/(4:15 PM|16:15)/)
    expect(formatLocalClock('2026-06-01T00:05')).toMatch(/(12:05 AM|00:05)/)
  })

  it('returns null for missing or malformed values', () => {
    expect(formatLocalClock(null)).toBeNull()
    expect(formatLocalClock('')).toBeNull()
    expect(formatLocalClock('sunrise')).toBeNull()
  })

  describe('formatSavedAt', () => {
    const base = new Date('2026-11-12T18:00:00Z').getTime()

    it('gives an absolute time for the viewer and a relative age', () => {
      const saved = formatSavedAt(base - 3 * 3_600_000, base)
      expect(saved.relative).toBe('about 3 hours ago')
      expect(saved.absolute).toMatch(/Nov/)
      expect(saved.absolute).toMatch(/\d{1,2}:\d{2}/)
    })

    it('describes very recent and older data sensibly', () => {
      expect(formatSavedAt(base - 20_000, base).relative).toBe('less than a minute ago')
      expect(formatSavedAt(base - 5 * 60_000, base).relative).toBe('5 minutes ago')
      expect(formatSavedAt(base - 2 * 86_400_000, base).relative).toBe('2 days ago')
    })
  })
})
