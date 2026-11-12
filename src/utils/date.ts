import { format, parse } from 'date-fns'

/** Format an instant in a specific IANA timezone; falls back to the device timezone if it is unknown. */
function formatInTimezone(
  date: Date,
  timezone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date)
  }
}

/** e.g. "Thursday, 12 November" at the location. */
export function formatLocalDate(date: Date, timezone?: string): string {
  return formatInTimezone(date, timezone, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** e.g. "17:45" at the location. */
export function formatLocalTime(date: Date, timezone?: string): string {
  return formatInTimezone(date, timezone, { hour: 'numeric', minute: '2-digit' })
}

/** Parse a "YYYY-MM-DD" calendar date without timezone shifting. */
export function parseCalendarDate(value: string): Date {
  return parse(value, 'yyyy-MM-dd', new Date(0))
}

/** Day label for forecast cards: "Today" for the first day, otherwise the short weekday. */
export function formatForecastDay(date: string, index: number): string {
  return index === 0 ? 'Today' : format(parseCalendarDate(date), 'EEE')
}

/** Full label for assistive technology, e.g. "Friday 13 November". */
export function formatForecastDayLong(date: string, index: number): string {
  const long = format(parseCalendarDate(date), 'EEEE d MMMM')
  return index === 0 ? `Today, ${long}` : long
}

export function formatForecastShortDate(date: string): string {
  return format(parseCalendarDate(date), 'd MMM')
}

/**
 * Wall-clock time of a local ISO string such as "2026-11-12T07:13", formatted like the live
 * local-time clock. The digits are the city's own time, so they are formatted as-is (via UTC)
 * with no timezone conversion. Returns null for missing or malformed values.
 */
export function formatLocalClock(value: string | null): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value) : null
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  const instant = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!))
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(instant)
}
