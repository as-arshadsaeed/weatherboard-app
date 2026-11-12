import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTheme } from '@/hooks/useTheme'
import { resetStorageStateForTests } from '@/services/storageService'

type Listener = () => void

/** Install a controllable matchMedia mock. Returns a function that flips the OS setting. */
function mockSystemTheme(initialDark: boolean) {
  let dark = initialDark
  const listeners = new Set<Listener>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('dark') ? dark : false
    },
    media: query,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }))
  return (next: boolean) => {
    dark = next
    listeners.forEach((l) => l())
  }
}

beforeEach(() => resetStorageStateForTests())
afterEach(() => vi.unstubAllGlobals())

describe('useTheme', () => {
  it('detects a dark OS preference on first visit', () => {
    mockSystemTheme(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.isFollowingSystem).toBe(true)
    expect(document.documentElement).toHaveClass('dark')
  })

  it('detects a light OS preference on first visit', () => {
    mockSystemTheme(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('follows live OS changes until the user chooses manually', () => {
    const setSystemDark = mockSystemTheme(false)
    const { result } = renderHook(() => useTheme())
    act(() => setSystemDark(true))
    expect(result.current.theme).toBe('dark')
  })

  it('switches without reload and persists the manual choice', () => {
    mockSystemTheme(false)
    const { result, unmount } = renderHook(() => useTheme())

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.isFollowingSystem).toBe(false)
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('weatherboard:theme')).toBe('"dark"')

    unmount()
    // A fresh mount (simulating a reload) restores the saved choice.
    const { result: reloaded } = renderHook(() => useTheme())
    expect(reloaded.current.theme).toBe('dark')
  })

  it('lets a saved manual choice override the OS preference', () => {
    mockSystemTheme(true)
    window.localStorage.setItem('weatherboard:theme', '"light"')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('ignores a corrupted saved value and falls back to the OS preference', () => {
    mockSystemTheme(true)
    window.localStorage.setItem('weatherboard:theme', '"purple"')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('still works when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('keeps working when localStorage is unavailable', () => {
    mockSystemTheme(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
  })

  describe('browser theme colour', () => {
    function addMetas() {
      document.head.innerHTML =
        '<meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)">' +
        '<meta name="theme-color" content="#0a0c11" media="(prefers-color-scheme: dark)">'
    }
    const colours = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'))
    afterEach(() => (document.head.innerHTML = ''))

    it('matches the theme, including a manual override of the OS theme', () => {
      addMetas()
      mockSystemTheme(false)
      const { result } = renderHook(() => useTheme())
      expect(colours()).toEqual(['#f8fafc', '#f8fafc'])

      act(() => result.current.toggleTheme())
      expect(colours()).toEqual(['#0a0c11', '#0a0c11'])
      act(() => result.current.toggleTheme())
      expect(colours()).toEqual(['#f8fafc', '#f8fafc'])
    })

    it('does nothing (and does not throw) when there is no theme-color tag', () => {
      mockSystemTheme(true)
      expect(() => renderHook(() => useTheme())).not.toThrow()
    })
  })
})
