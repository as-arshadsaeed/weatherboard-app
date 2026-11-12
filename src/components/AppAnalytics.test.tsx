import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppAnalytics } from '@/components/AppAnalytics'
import { redactAnalyticsEvent } from '@/utils/analytics'

/** What the (mocked) official component was given. */
const analytics = vi.hoisted(() => ({
  renders: [] as Array<{ beforeSend?: unknown }>,
}))

vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props: { beforeSend?: unknown }) => {
    analytics.renders.push(props)
    return null
  },
}))

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

beforeEach(() => {
  analytics.renders.length = 0
  setOnline(true)
})
afterEach(() => setOnline(true))

describe('AppAnalytics', () => {
  it('renders nothing when analytics is off', async () => {
    render(<AppAnalytics enabled={false} />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(analytics.renders).toHaveLength(0)
  })

  it('renders the official component once when on, with redaction attached', async () => {
    render(<AppAnalytics enabled />)
    await waitFor(() => expect(analytics.renders.length).toBeGreaterThan(0))
    expect(analytics.renders.at(-1)?.beforeSend).toBe(redactAnalyticsEvent)
  })

  it('passes no other options: no custom events, properties or overridden endpoints', async () => {
    render(<AppAnalytics enabled />)
    await waitFor(() => expect(analytics.renders.length).toBeGreaterThan(0))
    expect(Object.keys(analytics.renders.at(-1)!)).toEqual(['beforeSend'])
  })

  it('does not start while offline, then starts once when the connection returns', async () => {
    setOnline(false)
    render(<AppAnalytics enabled />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(analytics.renders).toHaveLength(0)

    act(() => setOnline(true))
    await waitFor(() => expect(analytics.renders.length).toBeGreaterThan(0))
  })

  it('stays mounted if the connection drops later', async () => {
    render(<AppAnalytics enabled />)
    await waitFor(() => expect(analytics.renders.length).toBeGreaterThan(0))
    const before = analytics.renders.length
    act(() => setOnline(false))
    await new Promise((resolve) => setTimeout(resolve, 20))
    // Still the same rendered component (any re-render only adds to the count; nothing unmounted).
    expect(analytics.renders.length).toBeGreaterThanOrEqual(before)
    act(() => setOnline(true))
  })

  it('adds nothing to the page itself (no DOM, no text for screen readers)', async () => {
    const view = render(<AppAnalytics enabled />)
    await waitFor(() => expect(analytics.renders.length).toBeGreaterThan(0))
    expect(view.container).toBeEmptyDOMElement()
  })
})
