import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FavouriteButton } from '@/components/favourites/FavouriteButton'
import type { AddFavouriteResult } from '@/hooks/useFavourites'
import { london } from '@/test/cities'

function setup(isFavourite: boolean, addResult: AddFavouriteResult = 'added') {
  const onAdd = vi.fn(() => addResult)
  const onRequestRemove = vi.fn()
  const user = userEvent.setup()
  render(<FavouriteButton city={london} isFavourite={isFavourite} onAdd={onAdd} onRequestRemove={onRequestRemove} />)
  return { onAdd, onRequestRemove, user }
}

describe('FavouriteButton', () => {
  it('adds a city in one click and announces it', async () => {
    const { onAdd, onRequestRemove, user } = setup(false)
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onRequestRemove).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('London added to favourites.')
  })

  it('shows the saved state in words (not only colour) and explains the action', () => {
    setup(true)
    const button = screen.getByRole('button', { name: 'Saved' })
    expect(button).toHaveAccessibleDescription('Press to remove London from favourites.')
  })

  it('does not remove directly: it asks the parent to confirm', async () => {
    const { onAdd, onRequestRemove, user } = setup(true)
    await user.click(screen.getByRole('button', { name: 'Saved' }))
    expect(onRequestRemove).toHaveBeenCalledOnce()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('explains why nothing was added when the favourites are full', async () => {
    const { user } = setup(false, 'full')
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))
    expect(screen.getByText('Favourites are full (5 of 5). Remove one to save another.')).toBeVisible()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
