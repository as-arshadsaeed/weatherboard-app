import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'

function setup(open = true) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const utils = render(
    <ConfirmDialog
      open={open}
      title="Remove London from favourites?"
      description="You can save it again at any time."
      confirmLabel="Remove"
      cancelLabel="Keep"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel, user: userEvent.setup(), ...utils }
}

describe('ConfirmDialog', () => {
  it('is an alertdialog labelled by its title and described by its message', () => {
    setup()
    const dialog = screen.getByRole('alertdialog', { name: 'Remove London from favourites?' })
    expect(dialog).toHaveAccessibleDescription('You can save it again at any time.')
  })

  it('is not exposed while closed', () => {
    setup(false)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('opens and closes as the `open` prop changes', () => {
    const { rerender } = setup(false)
    const props = {
      title: 'Remove London from favourites?',
      description: 'x',
      confirmLabel: 'Remove',
      onConfirm: () => {},
      onCancel: () => {},
    }
    rerender(<ConfirmDialog open {...props} />)
    expect(screen.getByRole('alertdialog')).toBeVisible()
    rerender(<ConfirmDialog open={false} {...props} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('puts focus on the safe action (cancel) when it opens', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus()
  })

  it('confirms and cancels via the buttons', async () => {
    const { onConfirm, onCancel, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('treats Escape (the native cancel event) as cancel without closing by itself', () => {
    const { onCancel } = setup()
    const dialog = screen.getByRole('alertdialog')
    const event = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(event)
    expect(onCancel).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true) // state, not the browser, owns closing
  })

  it('cancels when the backdrop is clicked, but not when the content is', async () => {
    const { onCancel, user } = setup()
    await user.click(screen.getByText('You can save it again at any time.'))
    expect(onCancel).not.toHaveBeenCalled()
    await user.click(screen.getByRole('alertdialog')) // the dialog element itself = the backdrop area
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
