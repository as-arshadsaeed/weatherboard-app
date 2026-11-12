import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OfflineBanner } from '@/components/layout/OfflineBanner'

function setOnLine(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}
function goOffline() {
  setOnLine(false)
  act(() => void window.dispatchEvent(new Event('offline')))
}
function goOnline() {
  setOnLine(true)
  act(() => void window.dispatchEvent(new Event('online')))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('OfflineBanner', () => {
  it('renders nothing while online', () => {
    setOnLine(true)
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('appears when the app starts offline, and says what that means', () => {
    setOnLine(false)
    render(<OfflineBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('You’re offline.')
    expect(banner).toHaveTextContent('Weather you’ve viewed before is still available; other cities need a connection.')
  })

  it('appears when the connection drops', () => {
    setOnLine(true)
    render(<OfflineBanner />)
    goOffline()
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline.')
  })

  it('confirms briefly when the connection returns, then goes away', () => {
    setOnLine(false)
    render(<OfflineBanner />)
    goOnline()
    expect(screen.getByRole('status')).toHaveTextContent('You’re back online.')
    expect(screen.getByRole('status')).toHaveTextContent('Updating the weather…')
    expect(screen.queryByText('You’re offline.')).toBeNull()

    act(() => void vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('drops the "back online" message at once if the connection is lost again', () => {
    setOnLine(false)
    render(<OfflineBanner />)
    goOnline()
    goOffline()
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline.')
    act(() => void vi.advanceTimersByTime(10_000))
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline.') // timer from before did not clear it
  })
})
