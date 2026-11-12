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
