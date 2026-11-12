import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from '@/hooks/useMediaQuery'

function stubMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches
    },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }))
  return { set: (next: boolean) => { matches = next; listeners.forEach((l) => l()) }, listeners }
}

afterEach(() => vi.unstubAllGlobals())

describe('useMediaQuery', () => {
  it('reports whether the query matches, and follows changes', () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 48rem)'))
    expect(result.current).toBe(false)
    act(() => media.set(true))
    expect(result.current).toBe(true)
  })

  it('stops listening on unmount', () => {
    const media = stubMatchMedia(true)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 48rem)'))
    expect(media.listeners.size).toBe(1)
    unmount()
    expect(media.listeners.size).toBe(0)
  })

  it('is false, without throwing, where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(renderHook(() => useMediaQuery('(min-width: 48rem)')).result.current).toBe(false)
  })
})
