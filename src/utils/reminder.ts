import type { City } from '@/types/city'
import type { ReminderPreference } from '@/types/preferences'
import type { TemperatureUnit, WeatherReport } from '@/types/weather'
import { formatSavedAt } from '@/utils/date'
import {
  REMINDER_GRACE_MS,
  REMINDER_TIME_MAX,
  REMINDER_TIME_MIN,
} from '@/utils/constants'
import { formatTemperature } from '@/utils/temperature'
import { describeWeather } from '@/utils/weatherCodes'

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseReminderTime(time: string): { hours: number; minutes: number } | null {
  const match = TIME_PATTERN.exec(time)
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null
}

/** A well-formed time inside the selectable morning range (HH:mm strings compare correctly as text). */
export function isValidReminderTime(time: string): boolean {
  return parseReminderTime(time) !== null && time >= REMINDER_TIME_MIN && time <= REMINDER_TIME_MAX
}

/** Local calendar date as "YYYY-MM-DD". */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The moment `time` occurs on the local calendar day of `date`, + `dayOffset` days (DST-safe: uses calendar days). */
function momentOn(date: Date, time: string, dayOffset = 0): Date {
  const { hours, minutes } = parseReminderTime(time) ?? { hours: 8, minutes: 0 }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, hours, minutes, 0, 0)
}

type Schedule = Pick<ReminderPreference, 'time' | 'lastFiredOn'>

/**
 * When the next reminder is (or is due). If today's reminder has not fired yet and we are still inside
 * its grace window, that is today's moment (possibly just passed = due now); otherwise tomorrow's.
 */
export function nextReminderAt(now: Date, schedule: Schedule): Date {
  const today = momentOn(now, schedule.time)
  const alreadyFired = schedule.lastFiredOn === localDateKey(now)
  if (!alreadyFired && now.getTime() <= today.getTime() + REMINDER_GRACE_MS) return today
  return momentOn(now, schedule.time, 1)
}

/** Due = today's time has passed, it has not fired today, and we are within the grace window. */
export function isReminderDue(now: Date, schedule: Schedule): boolean {
  if (schedule.lastFiredOn === localDateKey(now)) return false
  const elapsed = now.getTime() - momentOn(now, schedule.time).getTime()
  return elapsed >= 0 && elapsed <= REMINDER_GRACE_MS
}

/** "8:00 AM" (or "08:00" in 24 h locales). */
export function formatReminderTime(time: string): string {
  const { hours, minutes } = parseReminderTime(time) ?? { hours: 8, minutes: 0 }
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, hours, minutes),
  )
}

/** "today at 8:00 AM" / "tomorrow at 8:00 AM". */
export function describeNextReminder(now: Date, schedule: Schedule): string {
  const next = nextReminderAt(now, schedule)
  const day = localDateKey(next) === localDateKey(now) ? 'today' : 'tomorrow'
  return `${day} at ${formatReminderTime(schedule.time)}`
}

// ---------------------------------------------------------------------------
// Message content
// ---------------------------------------------------------------------------

export interface ReminderWeather {
  report: WeatherReport
  /** `saved` = from the offline store because a fresh forecast could not be fetched. */
  source: 'live' | 'saved'
}

export interface ReminderMessage {
  title: string
  body: string
}

interface MessageInput {
  city: City | null
  unit: TemperatureUnit
  weather: ReminderWeather | null
  now?: number
}

/**
 * The text of a reminder, for the city and unit selected *at the moment it fires*. Degrades honestly:
 * with no city it asks the user to pick one; with a city but no weather it does not invent any;
 * saved weather is labelled with its age.
 */
export function buildReminderMessage({ city, unit, weather, now = Date.now() }: MessageInput): ReminderMessage {
  if (!city) {
    return {
      title: 'WeatherBoard daily reminder',
      body: 'Open WeatherBoard and choose a city to see today’s weather.',
    }
  }
  const title = `Weather in ${city.name}`
  if (!weather) {
    return { title, body: `Open WeatherBoard to check today’s weather in ${city.name}.` }
  }

  const { current, daily } = weather.report
  const today = daily[0]
  const condition = describeWeather(current.weatherCode, current.isDay).label

  const parts: string[] = [`${condition}, ${formatTemperature(current.temperatureC, unit)}`]
  if (current.apparentTemperatureC !== null) {
    parts[0] += `, feels like ${formatTemperature(current.apparentTemperatureC, unit)}`
  }
  if (today) {
    let range = `Today: high ${formatTemperature(today.maxTemperatureC, unit)}, low ${formatTemperature(today.minTemperatureC, unit)}`
    if (today.precipitationProbabilityPercent !== null) {
      range += `, ${Math.round(today.precipitationProbabilityPercent)}% chance of precipitation`
    }
    parts.push(range)
  }
  if (weather.source === 'saved') {
    parts.push(`Saved weather from ${formatSavedAt(weather.report.fetchedAt, now).relative}`)
  }
  return { title, body: `${parts.join('. ')}.` }
}

/**
 * `lastFiredOn` to store when a reminder is switched on or its time changes. If today's time has already
 * passed, today counts as done, so enabling at 8:10 does not fire an immediate "8:00" reminder; the
 * first one is the next occurrence. If today's time is still ahead, it is free to fire today.
 */
export function armedLastFiredOn(now: Date, time: string): string | null {
  return now.getTime() >= momentOn(now, time).getTime() ? localDateKey(now) : null
}
