import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ReminderBanner } from '@/components/layout/ReminderBanner'

const message = { title: 'Weather in London', body: 'Partly cloudy, 7°C.' }

describe('ReminderBanner', () => {
  it('shows a daily reminder with its city and weather', () => {
    render(<ReminderBanner reminder={{ id: 1, kind: 'scheduled', message }} onDismiss={() => {}} />)
    const banner = screen.getByRole('status', { name: 'Daily weather reminder' })
    expect(banner).toHaveTextContent('Daily weather reminder · Weather in London')
    expect(banner).toHaveTextContent('Partly cloudy, 7°C.')
  })

  it('labels a test reminder as a test', () => {
    render(<ReminderBanner reminder={{ id: 2, kind: 'test', message }} onDismiss={() => {}} />)
    expect(screen.getByRole('status', { name: 'Test reminder' })).toHaveTextContent('Test reminder · Weather in London')
  })

  it('can be dismissed', async () => {
    const onDismiss = vi.fn()
    render(<ReminderBanner reminder={{ id: 1, kind: 'scheduled', message }} onDismiss={onDismiss} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss reminder' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
