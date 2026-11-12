import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MobileNavigation } from '@/components/layout/MobileNavigation'

function setup(view: 'weather' | 'favourites' = 'weather', favouriteCount = 0) {
  const onChange = vi.fn()
  const onOpenSettings = vi.fn()
  const user = userEvent.setup()
  render(<MobileNavigation view={view} onChange={onChange} favouriteCount={favouriteCount} onOpenSettings={onOpenSettings} />)
  return { onChange, onOpenSettings, user }
}

describe('MobileNavigation', () => {
  it('is a labelled navigation landmark with Weather and Favourites', () => {
    setup()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toBeVisible()
    expect(screen.getByRole('button', { name: 'Weather' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Favourites' })).toBeVisible()
  })

  it('marks only the current view with aria-current="page"', () => {
    setup('favourites')
    expect(screen.getByRole('button', { name: 'Favourites' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Weather' })).not.toHaveAttribute('aria-current')
  })

  it('reports the chosen view', async () => {
    const { onChange, user } = setup('weather')
    await user.click(screen.getByRole('button', { name: 'Favourites' }))
    expect(onChange).toHaveBeenCalledWith('favourites')
    await user.click(screen.getByRole('button', { name: 'Weather' }))
    expect(onChange).toHaveBeenLastCalledWith('weather')
  })

  it('works from the keyboard', async () => {
    const { onChange, user } = setup('weather')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Weather' })).toHaveFocus()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('favourites')
  })

  it('announces how many favourites are saved, without a bare number', () => {
    setup('weather', 3)
    expect(screen.getByRole('button', { name: 'Favourites, 3 of 5 saved' })).toBeVisible()
  })

  it('shows no count when there are no favourites', () => {
    setup('weather', 0)
    expect(screen.getByRole('button', { name: 'Favourites' })).toBeVisible()
    expect(screen.queryByText('0')).toBeNull()
  })

  describe('Settings', () => {
    it('is a button that opens the settings dialog; it is not a view', async () => {
      const { onChange, onOpenSettings, user } = setup('weather')
      const button = screen.getByRole('button', { name: 'Settings' })
      expect(button).toHaveAttribute('aria-haspopup', 'dialog')
      await user.click(button)
      expect(onOpenSettings).toHaveBeenCalledOnce()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('never takes aria-current, whatever the view', () => {
      setup('favourites')
      expect(screen.getByRole('button', { name: 'Settings' })).not.toHaveAttribute('aria-current')
    })

    it('is reachable by keyboard after the other tabs', async () => {
      const { onOpenSettings, user } = setup('weather')
      await user.tab()
      await user.tab()
      await user.tab()
      expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus()
      await user.keyboard('{Enter}')
      expect(onOpenSettings).toHaveBeenCalledOnce()
    })
  })
})
