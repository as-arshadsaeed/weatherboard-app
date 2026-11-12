import { describe, expect, it } from 'vitest'

import { london } from '@/test/cities'
import { buildReport } from '@/test/fixtures/report'
import {
  buildReminderMessage,
  describeNextReminder,
  formatReminderTime,
  isReminderDue,
  isValidReminderTime,
  localDateKey,
  nextReminderAt,
  parseReminderTime,
} from '@/utils/reminder'

// Local-time constructors, so these pass in any timezone.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0)
const schedule = (time: string, lastFiredOn: string | null = null) => ({ time, lastFiredOn })

describe('reminder time validation', () => {
  it('parses HH:mm', () => {
    expect(parseReminderTime('08:30')).toEqual({ hours: 8, minutes: 30 })
    expect(parseReminderTime('00:00')).toEqual({ hours: 0, minutes: 0 })
    expect(parseReminderTime('8:30')).toBeNull()
    expect(parseReminderTime('25:00')).toBeNull()
    expect(parseReminderTime('')).toBeNull()
  })

  it('accepts only morning times (05:00 to 11:59)', () => {
    for (const ok of ['05:00', '08:00', '11:59']) expect(isValidReminderTime(ok), ok).toBe(true)
    for (const bad of ['04:59', '12:00', '18:30', '00:00', '', '8:00', '07:60']) {
      expect(isValidReminderTime(bad), bad).toBe(false)
    }
  })

  it('formats for display and says "today" or "tomorrow"', () => {
    expect(formatReminderTime('08:00')).toMatch(/^0?8:00/)
    expect(describeNextReminder(at(2026, 11, 13, 7, 0), schedule('08:00'))).toMatch(/^today at 0?8:00/)
    expect(describeNextReminder(at(2026, 11, 13, 9, 0), schedule('08:00'))).toMatch(/^tomorrow at 0?8:00/)
  })
})

describe('localDateKey', () => {
  it('uses the local calendar date, zero-padded', () => {
    expect(localDateKey(at(2026, 1, 5, 23, 59))).toBe('2026-01-05')
    expect(localDateKey(at(2026, 12, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('nextReminderAt', () => {
  it('is today when the time is still ahead and has not fired', () => {
    expect(nextReminderAt(at(2026, 11, 13, 7, 0), schedule('08:00'))).toEqual(at(2026, 11, 13, 8, 0))
  })

  it('is tomorrow when today has already fired', () => {
    const next = nextReminderAt(at(2026, 11, 13, 7, 0), schedule('08:00', '2026-11-13'))
    expect(next).toEqual(at(2026, 11, 14, 8, 0))
  })

  it('stays "today" (due now) shortly after the time, inside the grace window', () => {
    expect(nextReminderAt(at(2026, 11, 13, 8, 10), schedule('08:00'))).toEqual(at(2026, 11, 13, 8, 0))
  })

  it('is tomorrow once the grace window has passed (a missed reminder is skipped)', () => {
    expect(nextReminderAt(at(2026, 11, 13, 8, 31), schedule('08:00'))).toEqual(at(2026, 11, 14, 8, 0))
  })

  it('rolls over month and year ends', () => {
    expect(nextReminderAt(at(2026, 12, 31, 9, 0), schedule('08:00'))).toEqual(at(2027, 1, 1, 8, 0))
  })

  it('a reminder fired yesterday does not block today', () => {
    expect(nextReminderAt(at(2026, 11, 13, 7, 0), schedule('08:00', '2026-11-12'))).toEqual(at(2026, 11, 13, 8, 0))
  })
})

describe('isReminderDue', () => {
  it('is not due before the time', () => {
    expect(isReminderDue(at(2026, 11, 13, 7, 59), schedule('08:00'))).toBe(false)
  })

  it('is due at the time and until the grace window ends', () => {
    expect(isReminderDue(at(2026, 11, 13, 8, 0), schedule('08:00'))).toBe(true)
    expect(isReminderDue(at(2026, 11, 13, 8, 30), schedule('08:00'))).toBe(true)
  })

  it('is not due after the grace window: a missed reminder is skipped, not fired late', () => {
    expect(isReminderDue(at(2026, 11, 13, 8, 31), schedule('08:00'))).toBe(false)
    expect(isReminderDue(at(2026, 11, 13, 14, 0), schedule('08:00'))).toBe(false)
  })

  it('never fires twice in a day', () => {
    expect(isReminderDue(at(2026, 11, 13, 8, 1), schedule('08:00', '2026-11-13'))).toBe(false)
  })

  it('fires again the next day', () => {
    expect(isReminderDue(at(2026, 11, 14, 8, 0), schedule('08:00', '2026-11-13'))).toBe(true)
  })
})

describe('buildReminderMessage', () => {
  const NOW = new Date('2026-11-13T09:00:00Z').getTime()
  const live = { report: buildReport(NOW, 6.7), source: 'live' as const }

  it('describes the weather for the selected city in Celsius', () => {
    const message = buildReminderMessage({ city: london, unit: 'celsius', weather: live, now: NOW })
    expect(message.title).toBe('Weather in London')
    expect(message.body).toBe('Partly cloudy, 7°C, feels like 3°C. Today: high 8°C, low 5°C, 0% chance of precipitation.')
  })

  it('uses the selected unit throughout, never mixing units', () => {
    const message = buildReminderMessage({ city: london, unit: 'fahrenheit', weather: live, now: NOW })
    expect(message.body).toBe('Partly cloudy, 44°F, feels like 37°F. Today: high 47°F, low 40°F, 0% chance of precipitation.')
    expect(message.body).not.toMatch(/°C/)
  })

  it('omits what the API did not provide instead of inventing it', () => {
    const report = buildReport(NOW, 6.7)
    report.current.apparentTemperatureC = null
    report.daily[0]!.precipitationProbabilityPercent = null
    const message = buildReminderMessage({ city: london, unit: 'celsius', weather: { report, source: 'live' }, now: NOW })
    expect(message.body).toBe('Partly cloudy, 7°C. Today: high 8°C, low 5°C.')
  })

  it('labels saved weather with its age', () => {
    const report = buildReport(NOW - 3 * 3_600_000, 6.7)
    const message = buildReminderMessage({ city: london, unit: 'celsius', weather: { report, source: 'saved' }, now: NOW })
    expect(message.body).toMatch(/Saved weather from about 3 hours ago\.$/)
  })

  it('does not invent weather when none could be loaded', () => {
    const message = buildReminderMessage({ city: london, unit: 'celsius', weather: null, now: NOW })
    expect(message.title).toBe('Weather in London')
    expect(message.body).toBe('Open WeatherBoard to check today’s weather in London.')
    expect(message.body).not.toMatch(/\d/)
  })

  it('asks the user to choose a city when none is selected', () => {
    const message = buildReminderMessage({ city: null, unit: 'celsius', weather: null, now: NOW })
    expect(message.title).toBe('WeatherBoard daily reminder')
    expect(message.body).toBe('Open WeatherBoard and choose a city to see today’s weather.')
  })
})
