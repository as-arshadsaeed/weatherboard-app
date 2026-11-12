import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { UnitToggle } from '@/components/settings/UnitToggle'

describe('UnitToggle', () => {
  it('is a labelled group of two toggle buttons reflecting the current unit', () => {
    render(<UnitToggle unit="celsius" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Temperature unit' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Celsius (°C)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Fahrenheit (°F)' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the visible label inside the accessible name (WCAG label-in-name)', () => {
    render(<UnitToggle unit="celsius" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /°C/ })).toHaveTextContent('°C')
    expect(screen.getByRole('button', { name: /°F/ })).toHaveTextContent('°F')
  })

  it('reports the chosen unit on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<UnitToggle unit="celsius" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Fahrenheit (°F)' }))
    expect(onChange).toHaveBeenCalledWith('fahrenheit')
  })

  it('works from the keyboard (Tab to a button, Enter/Space to choose)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<UnitToggle unit="celsius" onChange={onChange} />)
    await user.tab()
    await user.tab() // Celsius → Fahrenheit
    expect(screen.getByRole('button', { name: 'Fahrenheit (°F)' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('fahrenheit')
  })

  it('shows Fahrenheit as pressed when that unit is active', () => {
    render(<UnitToggle unit="fahrenheit" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Fahrenheit (°F)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Celsius (°C)' })).toHaveAttribute('aria-pressed', 'false')
  })
})
