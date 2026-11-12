import type { TemperatureUnit } from '@/types/weather'

export type ThemeMode = 'light' | 'dark'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

export function isTemperatureUnit(value: unknown): value is TemperatureUnit {
  return value === 'celsius' || value === 'fahrenheit'
}

/** Daily reminder settings (persisted in localStorage). */
export interface ReminderPreference {
  enabled: boolean
  /** Local time of day, "HH:mm" (24 h). */
  time: string
  /** Local date ("YYYY-MM-DD") the reminder last fired, so it never fires twice in a day. */
  lastFiredOn: string | null
}

export function isReminderPreference(value: unknown): value is ReminderPreference {
  if (typeof value !== 'object' || value === null) return false
  const preference = value as Record<string, unknown>
  return (
    typeof preference.enabled === 'boolean' &&
    typeof preference.time === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(preference.time) &&
    (preference.lastFiredOn === null ||
      (typeof preference.lastFiredOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(preference.lastFiredOn)))
  )
}
