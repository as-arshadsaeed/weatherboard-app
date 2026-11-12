import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSelectedCity } from '@/hooks/useSelectedCity'
import { resetStorageStateForTests } from '@/services/storageService'
import { london, paris } from '@/test/cities'

beforeEach(() => resetStorageStateForTests())
afterEach(() => window.history.replaceState({}, '', '/'))

describe('useSelectedCity', () => {
  it('starts with no city', () => {
    const { result } = renderHook(() => useSelectedCity())
    expect(result.current.city).toBeNull()
  })

  it('selecting a city shows it and remembers it after a reload', () => {
    const first = renderHook(() => useSelectedCity())
    act(() => first.result.current.selectCity(london))
    expect(first.result.current.city).toEqual(london)
    first.unmount()

    const second = renderHook(() => useSelectedCity())
    expect(second.result.current.city).toEqual(london)
  })

  it('a location in the URL wins over the remembered city', () => {
    window.localStorage.setItem('weatherboard:selectedCity', JSON.stringify(london))
    window.history.replaceState({}, '', '/?lat=48.85&lon=2.35&name=Paris')
    const { result } = renderHook(() => useSelectedCity())
    expect(result.current.city?.name).toBe('Paris')
  })

  it('does not overwrite the remembered city just because a deep link was opened', () => {
    window.localStorage.setItem('weatherboard:selectedCity', JSON.stringify(london))
    window.history.replaceState({}, '', '/?lat=48.85&lon=2.35&name=Paris')
    renderHook(() => useSelectedCity())
    expect(JSON.parse(window.localStorage.getItem('weatherboard:selectedCity')!).name).toBe('London')
  })

  it.each(['{not json', '"London"', JSON.stringify({ id: 'x', name: 'Bad', latitude: 999, longitude: 0 })])(
    'ignores a corrupted remembered city (%s)',
    (raw) => {
      window.localStorage.setItem('weatherboard:selectedCity', raw)
      const { result } = renderHook(() => useSelectedCity())
      expect(result.current.city).toBeNull()
    },
  )

  it('replaces the remembered city when another is selected', () => {
    const { result } = renderHook(() => useSelectedCity())
    act(() => result.current.selectCity(london))
    act(() => result.current.selectCity(paris))
    expect(JSON.parse(window.localStorage.getItem('weatherboard:selectedCity')!).name).toBe('Paris')
  })
})
