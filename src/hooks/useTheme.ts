import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { getStoredValue, setStoredValue } from '@/services/storageService'
import { isThemeMode, type ThemeMode } from '@/types/preferences'
import { THEME_COLORS } from '@/utils/constants'

/** Keep in sync with the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = 'theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSystemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

/**
 * Light/dark theme with OS detection on first visit.
 * A manual choice is persisted and wins over the OS; until then the OS setting is followed live.
 */
export function useTheme() {
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemPrefersDark,
    () => false,
  )
  const [manualTheme, setManualTheme] = useState<ThemeMode | null>(() =>
    getStoredValue(THEME_STORAGE_KEY, isThemeMode),
  )

  const theme: ThemeMode = manualTheme ?? (systemPrefersDark ? 'dark' : 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    // Recolour the browser/status bar to match, including when the user overrides the OS theme.
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', THEME_COLORS[theme]))
  }, [theme])

  const setTheme = useCallback((next: ThemeMode) => {
    setManualTheme(next)
    setStoredValue(THEME_STORAGE_KEY, next)
  }, [])

  const toggleTheme = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [setTheme, theme],
  )

  return { theme, isFollowingSystem: manualTheme === null, setTheme, toggleTheme }
}
