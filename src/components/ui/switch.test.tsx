import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Switch } from '@/components/ui/switch'

function setup(checked: boolean) {
  const onCheckedChange = vi.fn()
  render(
    <>
      <span id="label">Daily reminder</span>
      <span id="hint">Sends a summary</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} labelledBy="label" describedBy="hint" />
    </>,
  )
  return { onCheckedChange, user: userEvent.setup() }
}

describe('Switch', () => {
  it('is a labelled, described switch exposing its state', () => {
    setup(false)
    const toggle = screen.getByRole('switch', { name: 'Daily reminder' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveAccessibleDescription('Sends a summary')
  })

  it('reports on and off', () => {
    const { rerender } = render(<Switch checked onCheckedChange={() => {}} labelledBy="l" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    rerender(<Switch checked={false} onCheckedChange={() => {}} labelledBy="l" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('asks for the opposite value when clicked', async () => {
    const { onCheckedChange, user } = setup(false)
    await user.click(screen.getByRole('switch'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('asks to turn off when it is on', async () => {
    const { onCheckedChange, user } = setup(true)
    await user.click(screen.getByRole('switch'))
    expect(onCheckedChange).toHaveBeenCalledWith(false)
  })

  it('works from the keyboard with Space and Enter', async () => {
    const { onCheckedChange, user } = setup(false)
    await user.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
    await user.keyboard(' ')
    await user.keyboard('{Enter}')
    expect(onCheckedChange).toHaveBeenCalledTimes(2)
  })

  it('shows its state with a mark as well as position, not colour alone', () => {
    const { rerender } = render(<Switch checked onCheckedChange={() => {}} labelledBy="l" />)
    expect(screen.getByRole('switch')).toHaveTextContent('✓')
    rerender(<Switch checked={false} onCheckedChange={() => {}} labelledBy="l" />)
    expect(screen.getByRole('switch')).toHaveTextContent('–')
  })
})
