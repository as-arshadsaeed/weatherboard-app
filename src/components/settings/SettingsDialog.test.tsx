import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SettingsDialog } from '@/components/settings/SettingsDialog'

function setup(open = true) {
  const onClose = vi.fn()
  const view = render(
    <SettingsDialog open={open} onClose={onClose}>
      <button>Inside</button>
    </SettingsDialog>,
  )
  return { onClose, user: userEvent.setup(), ...view }
}

describe('SettingsDialog', () => {
  it('is a modal dialog labelled "Settings"', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  })

  it('is not exposed while closed, and mounts its content only while open', () => {
    const { rerender, onClose } = setup(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Inside' })).toBeNull()

    rerender(<SettingsDialog open onClose={onClose}><button>Inside</button></SettingsDialog>)
    expect(screen.getByRole('button', { name: 'Inside' })).toBeVisible()
  })

  it('closes with the Close button', async () => {
    const { onClose, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('treats Escape (the native cancel event) as close, leaving state in charge', () => {
    const { onClose } = setup()
    const event = new Event('cancel', { cancelable: true })
    screen.getByRole('dialog').dispatchEvent(event)
    expect(onClose).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('closes when the backdrop is clicked, but not when content is', async () => {
    const { onClose, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Inside' }))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
