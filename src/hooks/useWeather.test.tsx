import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWeather } from '@/hooks/useWeather'
import { loadWeatherSnapshot, saveWeatherSnapshot } from '@/services/weatherCache'
import { buildReport } from '@/test/fixtures/report'
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

describe('useWeather: saved weather and offline behaviour', () => {
  const NOW = new Date('2026-11-12T18:00:00Z').getTime()
  const tokyo: City = { id: 'tokyo', name: 'Tokyo', latitude: 35.68, longitude: 139.65 }

  type Props = { city: City | null; online: boolean }
  const setup = (initial: Props) =>
    renderHook(({ city, online }: Props) => useWeather(city, online), { initialProps: initial })

  /** Wait until a snapshot for `city` has been written (saving is fire-and-forget). */
  const savedFor = (city: City) =>
    waitFor(async () => expect(await loadWeatherSnapshot(city)).not.toBeNull())

  const respondWith = (tempC: number) =>
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(buildForecastResponse({ current: { ...buildForecastResponse().current, temperature_2m: tempC } }))),
    )

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  describe('saving', () => {
    it('saves every successful forecast for next time', async () => {
      respondWith(6.7)
      const { result } = setup({ city: london, online: true })
      await waitFor(() => expect(result.current.state.status).toBe('success'))
      await savedFor(london)
      const snapshot = await loadWeatherSnapshot(london)
      expect(snapshot?.report.current.temperatureC).toBe(6.7)
      expect(snapshot?.savedAt).toBe(NOW)
    })

    it.each([
      ['a network failure', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
      ['a 503 outage', () => fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 503 })))],
      ['a 429 rate limit', () => fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 429 })))],
      ['a 400 rejection', () => fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ error: true }, { status: 400 })))],
      ['a malformed payload', () => fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ hello: 'world' })))],
    ])('never saves anything after %s', async (_label, arrange) => {
      arrange()
      const { result } = setup({ city: london, online: true })
      await waitFor(() => expect(result.current.state.status).toBe('error'))
      await new Promise((r) => setTimeout(r, 20))
      expect(await loadWeatherSnapshot(london)).toBeNull()
    })
  })

  describe('offline', () => {
    it('shows the saved forecast for that city, marked as saved, without any network request', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW - 3 * 3_600_000, 4.2))
      const { result } = setup({ city: london, online: false })

      await waitFor(() => expect(result.current.state.status).toBe('cached'))
      const state = result.current.state
      expect(state.status === 'cached' && state.reason).toBe('offline')
      expect(state.status === 'cached' && state.cachedAt).toBe(NOW - 3 * 3_600_000)
      expect(state.status === 'cached' && state.report.current.temperatureC).toBe(4.2)
      expect(state.status === 'cached' && state.refreshing).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('says plainly when there is no saved weather for the city', async () => {
      const { result } = setup({ city: london, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('error'))
      const state = result.current.state
      expect(state.status === 'error' && state.error.kind).toBe('offline')
      expect(state.status === 'error' && state.error.message).toMatch(/no saved weather is available for this city/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('never shows another city’s saved weather', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW, 4.2))
      const { result } = setup({ city: tokyo, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('error'))
      const state = result.current.state
      expect(state.status === 'error' && state.error.kind).toBe('offline')
    })

    it('still reports invalid coordinates as invalid, not as "offline"', async () => {
      const { result } = setup({ city: { id: 'x', name: 'Nowhere', latitude: 999, longitude: 0 }, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('error'))
      const state = result.current.state
      expect(state.status === 'error' && state.error.kind).toBe('invalid-location')
    })

    it('ignores a saved forecast older than 7 days', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW - 60_000))
      vi.setSystemTime(NOW + 8 * 24 * 3_600_000)
      const { result } = setup({ city: london, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('error'))
    })
  })

  describe('service unreachable while the browser thinks it is online', () => {
    it.each([
      ['a network failure', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
      ['a 503 outage', () => fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 503 })))],
      ['a 429 rate limit', () => fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 429 })))],
    ])('falls back to the saved forecast after %s', async (_label, arrange) => {
      await saveWeatherSnapshot(london, buildReport(NOW - 600_000, 4.2))
      arrange()
      const { result } = setup({ city: london, online: true })

      await waitFor(() => expect(result.current.state.status).toBe('cached'))
      const state = result.current.state
      expect(state.status === 'cached' && state.reason).toBe('unreachable')
      expect(state.status === 'cached' && state.report.current.temperatureC).toBe(4.2)
    })

    it('shows the real error when nothing was saved', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const { result } = setup({ city: london, online: true })
      await waitFor(() => expect(result.current.state.status).toBe('error'))
      const state = result.current.state
      expect(state.status === 'error' && state.error.message).toMatch(/internet connection/)
    })

    it('does not fall back for a location the API rejected (older data would not help)', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW))
      fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ error: true, reason: 'bad' }, { status: 400 })))
      const { result } = setup({ city: london, online: true })
      await waitFor(() => expect(result.current.state.status).toBe('error'))
      const state = result.current.state
      expect(state.status === 'error' && state.error.kind).toBe('invalid-location')
    })

    it('"try again" refreshes while still showing the saved forecast, then shows fresh data', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW - 600_000, 4.2))
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      const { result } = setup({ city: london, online: true })
      await waitFor(() => expect(result.current.state.status).toBe('cached'))

      respondWith(9.9)
      act(() => result.current.retry())
      const during = result.current.state
      expect(during.status === 'cached' && during.refreshing).toBe(true) // no skeleton flash
      await waitFor(() => expect(result.current.state.status).toBe('success'))
      const after = result.current.state
      expect(after.status === 'success' && after.report.current.temperatureC).toBe(9.9)
    })
  })

  describe('connectivity changes', () => {
    it('refreshes when the connection returns, updating what is saved', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW - 3_600_000, 4.2))
      const { result, rerender } = setup({ city: london, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('cached'))
      expect(fetchMock).not.toHaveBeenCalled()

      respondWith(11.1)
      rerender({ city: london, online: true })
      const during = result.current.state
      expect(during.status === 'cached' && during.refreshing).toBe(true)

      await waitFor(() => expect(result.current.state.status).toBe('success'))
      const fresh = result.current.state
      expect(fresh.status === 'success' && fresh.report.current.temperatureC).toBe(11.1)
      await waitFor(async () => expect((await loadWeatherSnapshot(london))?.report.current.temperatureC).toBe(11.1))
    })

    it('goes back to the saved forecast if the refresh on reconnect fails too', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW - 3_600_000, 4.2))
      const { result, rerender } = setup({ city: london, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('cached'))

      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      rerender({ city: london, online: true })
      await waitFor(() => {
        const s = result.current.state
        expect(s.status === 'cached' && s.reason === 'unreachable' && !s.refreshing).toBe(true)
      })
    })

    it('switches a fresh forecast to saved-and-labelled when the connection drops', async () => {
      respondWith(6.7)
      const { result, rerender } = setup({ city: london, online: true })
      await waitFor(() => expect(result.current.state.status).toBe('success'))
      await savedFor(london)

      rerender({ city: london, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('cached'))
      const state = result.current.state
      expect(state.status === 'cached' && state.reason).toBe('offline')
    })

    it('a different city shows the skeleton, not the previous city’s saved weather', async () => {
      await saveWeatherSnapshot(london, buildReport(NOW, 4.2))
      const { result, rerender } = setup({ city: london, online: false })
      await waitFor(() => expect(result.current.state.status).toBe('cached'))
      rerender({ city: tokyo, online: false })
      expect(result.current.state.status).toBe('loading')
    })
  })
})
