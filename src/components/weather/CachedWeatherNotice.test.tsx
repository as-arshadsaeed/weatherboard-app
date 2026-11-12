import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CachedWeatherNotice } from '@/components/weather/CachedWeatherNotice'

const NOW = new Date('2026-11-12T18:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('CachedWeatherNotice', () => {
  it('says the weather is saved and offline, shows when it was retrieved, and that it may be out of date', () => {
    render(<CachedWeatherNotice cachedAt={NOW - 3 * 3_600_000} reason="offline" refreshing={false} onRetry={() => {}} />)
    const notice = screen.getByRole('status', { name: 'Saved weather' })
    expect(notice).toHaveTextContent('You’re offline. Showing saved weather.')
    expect(notice).toHaveTextContent('Last updated')
    expect(notice).toHaveTextContent('about 3 hours ago')
    expect(notice).toHaveTextContent('Conditions may have changed since then.')
    expect(notice).toHaveTextContent('It will update automatically when you’re back online.')
  })

  it('marks the exact time up for machines and people', () => {
    render(<CachedWeatherNotice cachedAt={NOW - 3_600_000} reason="offline" refreshing={false} onRetry={() => {}} />)
    const time = screen.getByText(/\d{1,2}:\d{2}/, { selector: 'time' })
    expect(time).toHaveAttribute('datetime', new Date(NOW - 3_600_000).toISOString())
  })

  it('offers no retry while offline (there is nothing to retry until the connection returns)', () => {
    render(<CachedWeatherNotice cachedAt={NOW} reason="offline" refreshing={false} onRetry={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('when the service cannot be reached it says so and offers "Try again"', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<CachedWeatherNotice cachedAt={NOW - 600_000} reason="unreachable" refreshing={false} onRetry={onRetry} />)
    expect(screen.getByRole('status')).toHaveTextContent('Can’t reach the weather service. Showing saved weather.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows progress, and hides the retry button, while refreshing', () => {
    render(<CachedWeatherNotice cachedAt={NOW - 600_000} reason="unreachable" refreshing onRetry={() => {}} />)
    expect(screen.getByText('Updating…')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})
