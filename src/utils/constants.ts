/** Maximum number of favourite cities a user can save. */
export const MAX_FAVOURITES = 5

/** City search behaviour (spec §4.2 / §5). */
export const MIN_SEARCH_LENGTH = 2
export const SEARCH_DEBOUNCE_MS = 250
export const MAX_SUGGESTIONS = 6
export const SEARCH_REQUEST_TIMEOUT_MS = 8_000

/** Shown wherever the API provides no value, instead of a guess. */
export const UNAVAILABLE_TEXT = 'Not available'

/** Browser UI colours matching the --background token in each theme (see also vite.config.ts and index.html). */
export const THEME_COLORS = { light: '#f8fafc', dark: '#0a0c11' } as const

/** Daily reminders (spec §11). */
export const DEFAULT_REMINDER_TIME = '08:00'
/** Reminders are "morning" reminders: the selectable range (inclusive, "HH:mm"). */
export const REMINDER_TIME_MIN = '05:00'
export const REMINDER_TIME_MAX = '11:59'
/** How often an open app checks whether a reminder is due (timers are throttled in background tabs). */
export const REMINDER_CHECK_INTERVAL_MS = 30_000
/** A reminder still fires up to this long after its time (covers throttled tabs and laptop sleep). */
export const REMINDER_GRACE_MS = 30 * 60 * 1000
/** Shown before notification permission is requested (exact wording required by spec §11). */
export const REMINDER_PERMISSION_EXPLANATION =
  "We'd like to send you a daily morning reminder to check your local weather, so you can plan your day."
