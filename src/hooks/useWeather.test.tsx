import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWeather } from '@/hooks/useWeather'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import type { City } from '@/types/city'

const london: City = { id: 'london', name: 'London', latitude: 51.5, longitude: -0.12 }
const paris: City = { id: 'paris', name: 'Paris', latitude: 48.85, longitude: 2.35 }

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

/** A fetch that stays pending until resolved by the test (and honours abort). */
function deferredFetch() {
  let resolve!: (r: Response) => void
  let aborted = false
  const promise = new Promise<Response>((res, rej) => {
    resolve = res
    return rej
  })
  return {
    promise,
    resolve: (body: unknown) => resolve(jsonResponse(body)),
    wasAborted: () => aborted,
    markAborted: () => {
      aborted = true
    },
  }
}

describe('useWeather', () => {
  it('is idle without a city and makes no request', () => {
    const { result } = renderHook(() => useWeather(null))
    expect(result.current.state.status).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('goes from loading to success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    const { result } = renderHook(() => useWeather(london))

    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    const state = result.current.state
    expect(state.status === 'success' && state.report.daily).toHaveLength(5)
  })

  it('surfaces a specific error and recovers on retry', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useWeather(london))

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    const failed = result.current.state
    expect(failed.status === 'error' && failed.error.message).toMatch(/internet connection/)

    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    act(() => result.current.retry())
    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aborts the outdated request when the city changes', async () => {
    const signals: AbortSignal[] = []
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal)
      return new Promise(() => {})
    })
    const { rerender } = renderHook(({ city }) => useWeather(city), {
      initialProps: { city: london },
    })
    rerender({ city: paris })

    expect(signals).toHaveLength(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('ignores a late response for a previous city (no race condition)', async () => {
    const first = deferredFetch()
    const second = deferredFetch()
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook(({ city }) => useWeather(city), {
      initialProps: { city: london },
    })
    rerender({ city: paris })

    const parisBody = buildForecastResponse({ timezone: 'Europe/Paris', latitude: 48.85 })
    // Paris resolves first, then London's stale response arrives afterwards.
    await act(async () => second.resolve(parisBody))
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    await act(async () => first.resolve(buildForecastResponse({ timezone: 'Europe/London' })))

    const state = result.current.state
    expect(state.status === 'success' && state.report.timezone).toBe('Europe/Paris')
  })

  it('does not refetch when re-rendered with an equivalent city object', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    const { result, rerender } = renderHook(({ city }) => useWeather(city), {
      initialProps: { city: london },
    })
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    rerender({ city: { ...london } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports invalid coordinates as a non-retryable error without a network call', async () => {
    const { result } = renderHook(() =>
      useWeather({ id: 'x', name: 'Nowhere', latitude: 999, longitude: 0 }),
    )
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    const state = result.current.state
    expect(state.status === 'error' && state.error.isRetryable).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aborts the in-flight request on unmount', () => {
    let signal: AbortSignal | undefined
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal
      return new Promise(() => {})
    })
    const { unmount } = renderHook(() => useWeather(london))
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
