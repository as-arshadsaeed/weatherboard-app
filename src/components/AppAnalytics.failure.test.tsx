import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppAnalytics } from '@/components/AppAnalytics'

// The official package cannot be loaded at all (chunk missing, blocked, offline-before-cached…).
vi.mock('@vercel/analytics/react', () => {
  throw new Error('chunk failed to load')
})

describe('AppAnalytics when the package cannot be loaded', () => {
  it('renders nothing, throws nothing and leaves no unhandled rejection', async () => {
    const unhandled = vi.fn()
    window.addEventListener('unhandledrejection', unhandled)
    const view = render(<AppAnalytics enabled />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    window.removeEventListener('unhandledrejection', unhandled)

    expect(view.container).toBeEmptyDOMElement()
    expect(unhandled).not.toHaveBeenCalled()
  })
})
