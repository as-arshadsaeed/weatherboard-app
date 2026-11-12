import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StorageNotice } from '@/components/layout/StorageNotice'
import { probeStorage, resetStorageStateForTests, setStoredValue } from '@/services/storageService'

beforeEach(() => resetStorageStateForTests())

function blockWrites() {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
}

describe('StorageNotice', () => {
  it('renders nothing while storage works', () => {
    render(<StorageNotice />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('appears (non-blocking) when storage turns out to be unavailable', async () => {
    render(<StorageNotice />)
    blockWrites()
    await act(async () => probeStorage())
    expect(screen.getByRole('status')).toHaveTextContent('Settings can’t be saved.')
    expect(screen.getByRole('status')).toHaveTextContent('lost when you close this tab')
  })

  it('appears after a failed save, and disappears if saving starts working again', async () => {
    render(<StorageNotice />)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await act(async () => setStoredValue('k', 'v'))
    expect(screen.getByRole('status')).toBeVisible()

    setItem.mockRestore()
    await act(async () => setStoredValue('k', 'v'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('can be dismissed', async () => {
    const user = userEvent.setup()
    render(<StorageNotice />)
    blockWrites()
    await act(async () => probeStorage())
    await user.click(screen.getByRole('button', { name: 'Dismiss storage notice' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
