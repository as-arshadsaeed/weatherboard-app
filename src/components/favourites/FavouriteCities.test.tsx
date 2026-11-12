import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FavouriteCities } from '@/components/favourites/FavouriteCities'
import { berlin, london, londonFromOtherProvider, paris, tokyo } from '@/test/cities'

function setup(favourites = [london, paris, tokyo], selectedCity = paris) {
  const onSelect = vi.fn()
  const onRequestRemove = vi.fn()
  const user = userEvent.setup()
  render(
    <FavouriteCities favourites={favourites} selectedCity={selectedCity} onSelect={onSelect} onRequestRemove={onRequestRemove} />,
  )
  return { onSelect, onRequestRemove, user }
}

describe('FavouriteCities', () => {
  it('shows the empty state and a 0 / 5 count', () => {
    render(<FavouriteCities favourites={[]} selectedCity={null} onSelect={() => {}} onRequestRemove={() => {}} />)
    expect(screen.getByText('No favourites yet')).toBeVisible()
    expect(screen.getByLabelText('0 of 5 favourites saved')).toHaveTextContent('0 / 5')
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('lists each favourite with its region and country, and the count', () => {
    setup()
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('London')
    expect(items[0]).toHaveTextContent('England, United Kingdom')
    expect(screen.getByLabelText('3 of 5 favourites saved')).toBeVisible()
    expect(screen.queryByText('No favourites yet')).toBeNull()
  })

  it('switches to a favourite when it is chosen', async () => {
    const { onSelect, user } = setup()
    await user.click(screen.getByRole('button', { name: /^Tokyo/ }))
    expect(onSelect).toHaveBeenCalledWith(tokyo)
  })

  it('marks the city being shown with aria-current (not just colour)', () => {
    setup()
    expect(screen.getByRole('button', { name: /^Paris/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /^London/ })).not.toHaveAttribute('aria-current')
  })

  it('recognises the shown city even when it came from another provider', () => {
    setup([london, paris], londonFromOtherProvider)
    expect(screen.getByRole('button', { name: /^London/ })).toHaveAttribute('aria-current', 'true')
  })

  it('asks for confirmation instead of removing: remove buttons only request removal', async () => {
    const { onRequestRemove, onSelect, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Remove Tokyo from favourites' }))
    expect(onRequestRemove).toHaveBeenCalledWith(tokyo)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('has a distinct, labelled remove button per city', () => {
    setup([london, berlin])
    expect(screen.getByRole('button', { name: 'Remove London from favourites' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Remove Berlin from favourites' })).toBeVisible()
  })

  it('is fully keyboard operable: Tab through, Enter to switch', async () => {
    const { onSelect, user } = setup([london, paris], paris)
    await user.tab() // heading is not tabbable
    expect(screen.getByRole('button', { name: /^London/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(london)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Remove London from favourites' })).toHaveFocus()
  })
})
