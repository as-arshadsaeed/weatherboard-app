import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCitySearch } from '@/hooks/useCitySearch'
import { searchCities } from '@/services/citySearch'
import { CitySearchError } from '@/services/citySearchError'
import type { City } from '@/types/city'

vi.mock('@/services/citySearch', () => ({ searchCities: vi.fn() }))
const searchMock = vi.mocked(searchCities)

const london: City = { id: 'l', name: 'London', latitude: 51.5, longitude: -0.12 }
const paris: City = { id: 'p', name: 'Paris', latitude: 48.85, longitude: 2.35 }

/** Advance fake time and let resolved promises settle inside act(). */
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  searchMock.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('useCitySearch', () => {
  it('stays idle and makes no request below 2 characters', async () => {
    const { result } = renderHook(({ q }) => useCitySearch(q), { initialProps: { q: '' } })
    await advance(1000)
    expect(result.current.state.status).toBe('idle')

    const { result: one } = renderHook(() => useCitySearch('l'))
    await advance(1000)
    expect(one.current.state.status).toBe('idle')
    const { result: spaces } = renderHook(() => useCitySearch('   '))
    await advance(1000)
    expect(spaces.current.state.status).toBe('idle')
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('debounces: waits ~250 ms after the last keystroke before searching', async () => {
    searchMock.mockResolvedValue([london])
    renderHook(() => useCitySearch('lon'))

    await advance(249)
    expect(searchMock).not.toHaveBeenCalled()
    await advance(1)
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock.mock.calls[0]?.[0]).toBe('lon')
  })

  it('rapid typing triggers a single search for the final text', async () => {
    searchMock.mockResolvedValue([london])
    const { rerender } = renderHook(({ q }) => useCitySearch(q), { initialProps: { q: 'lo' } })
    for (const q of ['lon', 'lond', 'londo', 'london']) {
      await advance(100)
      rerender({ q })
    }
    await advance(250)

    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock.mock.calls[0]?.[0]).toBe('london')
  })

  it('goes loading → success with results', async () => {
    searchMock.mockResolvedValue([london, paris])
    const { result } = renderHook(() => useCitySearch('lon'))

    expect(result.current.state.status).toBe('loading')
    await advance(250)
    expect(result.current.state).toEqual({ status: 'success', query: 'lon', results: [london, paris] })
  })

  it('reports an empty result as success with no cities', async () => {
    searchMock.mockResolvedValue([])
    const { result } = renderHook(() => useCitySearch('zzz'))
    await advance(250)
    expect(result.current.state).toMatchObject({ status: 'success', results: [] })
  })

  it('surfaces a specific error and recovers on retry', async () => {
    searchMock.mockRejectedValueOnce(new CitySearchError('network'))
    const { result } = renderHook(() => useCitySearch('lon'))
    await advance(250)
    const failed = result.current.state
    expect(failed.status === 'error' && failed.error.message).toMatch(/internet connection/)

    searchMock.mockResolvedValue([london])
    act(() => result.current.retry())
    expect(result.current.state.status).toBe('loading')
    await advance(0)
    expect(result.current.state.status).toBe('success')
  })

  it('wraps unexpected errors in a user-friendly one', async () => {
    searchMock.mockRejectedValue(new Error('boom: internal detail'))
    const { result } = renderHook(() => useCitySearch('lon'))
    await advance(250)
    const state = result.current.state
    expect(state.status === 'error' && state.error.message).toBe(
      'City search is temporarily unavailable. Please try again.',
    )
  })

  it('aborts the outdated request when the text changes', async () => {
    const signals: AbortSignal[] = []
    searchMock.mockImplementation((_q, opts) => {
      signals.push(opts!.signal!)
      return new Promise(() => {})
    })
    const { rerender } = renderHook(({ q }) => useCitySearch(q), { initialProps: { q: 'lon' } })
    await advance(250)
    rerender({ q: 'lond' })
    await advance(250)

    expect(signals).toHaveLength(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('ignores a late response for superseded text (no race condition)', async () => {
    let resolveFirst!: (c: City[]) => void
    searchMock
      .mockImplementationOnce(() => new Promise<City[]>((res) => (resolveFirst = res)))
      .mockResolvedValueOnce([paris])

    const { result, rerender } = renderHook(({ q }) => useCitySearch(q), { initialProps: { q: 'lon' } })
    await advance(250)
    rerender({ q: 'par' })
    await advance(250)
    expect(result.current.state).toMatchObject({ status: 'success', query: 'par', results: [paris] })

    await act(async () => resolveFirst([london])) // stale answer arrives afterwards
    expect(result.current.state).toMatchObject({ status: 'success', query: 'par', results: [paris] })
  })

  it('keeps the previous results (marked with their own query) while the user keeps typing', async () => {
    searchMock.mockResolvedValue([london])
    const { result, rerender } = renderHook(({ q }) => useCitySearch(q), { initialProps: { q: 'lon' } })
    await advance(250)

    rerender({ q: 'lond' })
    expect(result.current.state).toMatchObject({ status: 'success', query: 'lon' })
    expect(result.current.query).toBe('lond')
  })

  it('returns to idle when the input is cleared', async () => {
    searchMock.mockResolvedValue([london])
    const { result, rerender } = renderHook(({ q }) => useCitySearch(q), { initialProps: { q: 'lon' } })
    await advance(250)
    rerender({ q: '' })
    expect(result.current.state.status).toBe('idle')
  })

  it('aborts the in-flight request on unmount', async () => {
    let signal: AbortSignal | undefined
    searchMock.mockImplementation((_q, opts) => {
      signal = opts?.signal
      return new Promise(() => {})
    })
    const { unmount } = renderHook(() => useCitySearch('lon'))
    await advance(250)
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
