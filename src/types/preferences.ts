export type ThemeMode = 'light' | 'dark'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}
