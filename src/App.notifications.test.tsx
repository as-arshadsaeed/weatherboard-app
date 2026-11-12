import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { resetStorageStateForTests } from '@/services/storageService'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import { REMINDER_PERMISSION_EXPLANATION } from '@/utils/constants'

type Permission = 'default' | 'granted' | 'denied'

function stubNotification(initial: Permission, answer: Permission = initial) {
  const shown: Array<{ title: string; options?: NotificationOptions }> = []
  class FakeNotification {
    static permission: Permission = initial
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = answer
      return answer
    })
    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, options })
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  return { FakeNotification, shown }
}

const stored = () => JSON.parse(window.localStorage.getItem('weatherboard:reminder') ?? 'null')
const header = () => screen.getByRole('banner')
const settingsDialog = () => screen.getByRole('dialog', { name: 'Settings' })

beforeEach(() => {
  resetStorageStateForTests()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(buildForecastResponse()))))
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('opening settings', () => {
  it('has a Settings button in the header that opens the settings dialog', async () => {
    stubNotification('default')
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()

    const button = within(header()).getByRole('button', { name: 'Settings' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(button)
    expect(settingsDialog()).toBeVisible()
    expect(within(settingsDialog()).getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  it('also opens from the bottom navigation on phones', async () => {
    stubNotification('default')
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Settings' }))
    expect(settingsDialog()).toBeVisible()
  })

  it('closes with its Close button and shows the reminder settings', async () => {
    stubNotification('default')
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    expect(within(settingsDialog()).getByRole('switch', { name: 'Daily weather reminder' })).toBeVisible()
    expect(within(settingsDialog()).getByLabelText('Reminder time')).toBeVisible()

    await user.click(within(settingsDialog()).getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
  })
})

describe('permission is requested only after an explicit choice', () => {
  it('does not ask on page load, when opening settings, or when merely turning the reminder on', async () => {
    const { FakeNotification } = stubNotification('default', 'granted')
    const user = userEvent.setup()
    render(<App />)
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()

    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()

    await user.click(within(settingsDialog()).getByRole('switch'))
    expect(within(settingsDialog()).getByText(REMINDER_PERMISSION_EXPLANATION)).toBeVisible()
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()

    await user.click(within(settingsDialog()).getByRole('button', { name: 'Allow notifications' }))
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce()
    expect(within(settingsDialog()).getByText('Notifications: Allowed')).toBeVisible()
  })

  it('keeps the reminder on, in-app only, when the user refuses', async () => {
    stubNotification('default', 'denied')
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    await user.click(within(settingsDialog()).getByRole('switch'))
    await user.click(within(settingsDialog()).getByRole('button', { name: 'Allow notifications' }))

    expect(within(settingsDialog()).getByText('Notifications: Blocked')).toBeVisible()
    expect(within(settingsDialog()).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(stored().enabled).toBe(true)
    // The dashboard is unaffected by a refusal.
    expect(screen.getByText('No city selected')).toBeVisible()
  })

  it('works in a browser with no Notification API: the dashboard and the in-app reminder are unaffected', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    expect(within(settingsDialog()).getByText('Notifications: Not supported')).toBeVisible()
    await user.click(within(settingsDialog()).getByRole('switch'))
    expect(within(settingsDialog()).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Search for a city' })).toBeEnabled()
  })
})

describe('persistence', () => {
  it('remembers the switch and the time after a reload', async () => {
    stubNotification('granted')
    const user = userEvent.setup()
    const first = render(<App />)
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    await user.click(within(settingsDialog()).getByRole('switch'))
    const time = within(settingsDialog()).getByLabelText('Reminder time')
    await user.clear(time)
    await user.type(time, '07:15')
    expect(stored()).toMatchObject({ enabled: true, time: '07:15' })
    first.unmount()

    render(<App />)
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    expect(within(settingsDialog()).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(within(settingsDialog()).getByLabelText('Reminder time')).toHaveValue('07:15')
  })

  it('does not save an invalid time', async () => {
    stubNotification('granted')
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    const time = within(settingsDialog()).getByLabelText('Reminder time')
    await user.clear(time)
    await user.type(time, '18:30')
    expect(stored()).toBeNull() // nothing was written
    expect(within(settingsDialog()).getByRole('alert')).toBeVisible()
  })

  it('works, and warns, when localStorage is unavailable', async () => {
    stubNotification('granted')
    const deny = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(deny)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(deny)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(deny)
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    await user.click(within(settingsDialog()).getByRole('switch'))
    expect(within(settingsDialog()).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(screen.getAllByText('Settings can’t be saved.').length).toBeGreaterThan(0))
  })
})

describe('reminders use the selected city and unit', () => {
  beforeEach(() => window.history.replaceState({}, '', '/?lat=51.5085&lon=-0.1257&name=London'))

  it('a test reminder shows the weather for the selected city in Celsius', async () => {
    stubNotification('denied')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    await user.click(within(settingsDialog()).getByRole('button', { name: 'Send a test reminder' }))

    const banner = await screen.findByRole('status', { name: 'Test reminder' })
    expect(banner).toHaveTextContent('Weather in London')
    expect(banner).toHaveTextContent('Partly cloudy, 7°C')
    expect(within(settingsDialog()).getByText('Weather in London')).toBeVisible() // previewed inside the dialog
  })

  it('and in the selected unit — Fahrenheit throughout, never mixed', async () => {
    stubNotification('denied')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(within(header()).getByRole('button', { name: 'Fahrenheit (°F)' }))
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    expect(within(settingsDialog()).getByText('Your reminder will show the weather for London in °F.')).toBeVisible()

    await user.click(within(settingsDialog()).getByRole('button', { name: 'Send a test reminder' }))
    const banner = await screen.findByRole('status', { name: 'Test reminder' })
    expect(banner).toHaveTextContent('Partly cloudy, 44°F, feels like 37°F')
    expect(banner).not.toHaveTextContent('°C')
  })

  it('shows a system notification for a test only when permission was granted', async () => {
    const { shown } = stubNotification('granted')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    await user.click(within(settingsDialog()).getByRole('button', { name: 'Send a test reminder' }))
    await waitFor(() => expect(shown).toHaveLength(1))
    expect(shown[0]!.title).toBe('Weather in London')
    expect(shown[0]!.options?.body).toContain('7°C')
  })

  it('shows no system notification, only the in-app banner, when permission is denied', async () => {
    const { shown } = stubNotification('denied')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    await user.click(within(settingsDialog()).getByRole('button', { name: 'Send a test reminder' }))
    expect(await screen.findByRole('status', { name: 'Test reminder' })).toBeVisible()
    expect(shown).toHaveLength(0)
  })

  it('a reminder can be dismissed', async () => {
    stubNotification('denied')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(within(header()).getByRole('button', { name: 'Settings' }))
    await user.click(within(settingsDialog()).getByRole('button', { name: 'Send a test reminder' }))
    await screen.findByRole('status', { name: 'Test reminder' })
    await user.click(within(settingsDialog()).getByRole('button', { name: 'Close settings' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss reminder' }))
    expect(screen.queryByRole('status', { name: 'Test reminder' })).toBeNull()
  })
})
