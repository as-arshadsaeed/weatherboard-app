import { render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { AppAnalytics } from '@/components/AppAnalytics'

// No mocks: this uses the real @vercel/analytics package in jsdom (which never downloads the script).
const scripts = () => document.querySelectorAll('script[src*="insights"], script[src*="vercel-scripts"]')

afterEach(() => {
  scripts().forEach((script) => script.remove())
  delete window.va
  delete window.vaq
  delete window.vai
})

describe('AppAnalytics with the real package', () => {
  it('injects the analytics script exactly once, even when StrictMode replays effects', async () => {
    render(
      <StrictMode>
        <AppAnalytics enabled />
      </StrictMode>,
    )
    await waitFor(() => expect(typeof window.va).toBe('function'))
    expect(scripts()).toHaveLength(1)
  })

  it('registers the redaction hook with the package', async () => {
    render(<AppAnalytics enabled />)
    await waitFor(() => expect(typeof window.va).toBe('function'))
    const hook = window.vaq?.find(([name]) => name === 'beforeSend')?.[1] as ((e: unknown) => { url: string } | null) | undefined
    expect(hook).toBeTypeOf('function')
    expect(hook!({ type: 'pageview', url: 'https://weatherboard.example/?lat=51.5&lon=-0.12&name=London' })?.url).toBe(
      'https://weatherboard.example/',
    )
  })

  it('does not touch the page at all when disabled', async () => {
    render(<AppAnalytics enabled={false} />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(window.va).toBeUndefined()
    expect(scripts()).toHaveLength(0)
  })
})
