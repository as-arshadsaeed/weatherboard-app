import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUnits } from '@/hooks/useUnits'
import { resetStorageStateForTests } from '@/services/storageService'

beforeEach(() => resetStorageStateForTests())

describe('useUnits', () => {
  it('defaults to Celsius', () => {
    const { result } = renderHook(() => useUnits())
    expect(result.current.unit).toBe('celsius')
  })

  it('switches immediately and persists the choice', () => {
    const { result } = renderHook(() => useUnits())
    act(() => result.current.setUnit('fahrenheit'))
    expect(result.current.unit).toBe('fahrenheit')
    expect(window.localStorage.getItem('weatherboard:unit')).toBe('"fahrenheit"')
  })

  it('restores the saved unit after a reload (fresh mount)', () => {
    const first = renderHook(() => useUnits())
    act(() => first.result.current.setUnit('fahrenheit'))
    first.unmount()

    const second = renderHook(() => useUnits())
    expect(second.result.current.unit).toBe('fahrenheit')
  })

  it.each(['"kelvin"', '42', '{not json', 'null'])('ignores a corrupted stored value (%s)', (raw) => {
    window.localStorage.setItem('weatherboard:unit', raw)
    const { result } = renderHook(() => useUnits())
    expect(result.current.unit).toBe('celsius')
  })

  it('keeps working in memory when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const { result } = renderHook(() => useUnits())
    expect(result.current.unit).toBe('celsius')
    act(() => result.current.setUnit('fahrenheit'))
    expect(result.current.unit).toBe('fahrenheit')
  })
})
