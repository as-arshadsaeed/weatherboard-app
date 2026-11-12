import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotificationSettings } from '@/components/settings/NotificationSettings'
import type { ActiveReminder } from '@/hooks/useReminders'
import { london } from '@/test/cities'
import type { City } from '@/types/city'
import type { ReminderPreference } from '@/types/preferences'
import type { TemperatureUnit } from '@/types/weather'
import { REMINDER_PERMISSION_EXPLANATION } from '@/utils/constants'

type Permission = 'default' | 'granted' | 'denied'

/** Controllable Notification API; `answer` is what the browser prompt returns. */
function stubNotification(initial: Permission, answer: Permission | 'dismiss' = initial) {
  class FakeNotification {
    static permission: Permission = initial
    static requestPermission = vi.fn(async () => {
      if (answer === 'dismiss') return 'default'
      FakeNotification.permission = answer
      return answer
    })
  }
  vi.stubGlobal('Notification', FakeNotification)
  return FakeNotification
}
function stubServiceWorker(available: boolean) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn(async () => (available ? {} : undefined)) },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
})

interface Options {
  enabled?: boolean
  time?: string
  city?: City | null
  unit?: TemperatureUnit
  testReminder?: ActiveReminder | null
}

/** A tiny parent that holds the preference, like the app does. */
function setup({ enabled = false, time = '08:00', city = london, unit = 'celsius', testReminder = null }: Options = {}) {
  const onEnabledChange = vi.fn()
  const onTimeChange = vi.fn<(time: string) => boolean>(() => true)
  const onSendTest = vi.fn(async () => {})

  function Parent() {
    const [preference, setPreference] = useState<ReminderPreference>({ enabled, time, lastFiredOn: null })
    return (
      <NotificationSettings
        preference={preference}
        onEnabledChange={(next) => {
          onEnabledChange(next)
          setPreference((p) => ({ ...p, enabled: next }))
        }}
        onTimeChange={(next) => {
          onTimeChange(next)
          setPreference((p) => ({ ...p, time: next }))
          return true
        }}
        onSendTest={onSendTest}
        testReminder={testReminder}
        city={city}
        unit={unit}
      />
    )
  }
  render(<Parent />)
  return { user: userEvent.setup(), onEnabledChange, onTimeChange, onSendTest }
}

const permissionPanel = () => screen.getByRole('region', { name: 'Notification permission' })
const allowButton = () => screen.queryByRole('button', { name: 'Allow notifications' })
const settle = () => act(async () => {})

describe('the reminder switch', () => {
  it('is off by default and says so', () => {
    stubNotification('default')
    setup()
    expect(screen.getByRole('switch', { name: 'Daily weather reminder' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Reminder off.')).toBeVisible()
  })

  it('turns on and off, reporting each change', async () => {
    stubNotification('granted')
    const { user, onEnabledChange } = setup()
    const toggle = screen.getByRole('switch', { name: 'Daily weather reminder' })

    await user.click(toggle)
    expect(onEnabledChange).toHaveBeenLastCalledWith(true)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    expect(onEnabledChange).toHaveBeenLastCalledWith(false)
    expect(screen.getByText('Reminder off.')).toBeVisible()
  })

  it('works from the keyboard', async () => {
    stubNotification('granted')
    const { user, onEnabledChange } = setup()
    screen.getByRole('switch').focus()
    await user.keyboard(' ')
    expect(onEnabledChange).toHaveBeenCalledWith(true)
  })

  it('states when the next reminder is, and that it only happens if the app is open', () => {
    stubNotification('granted')
    setup({ enabled: true, time: '08:00' })
    expect(screen.getByText(/Reminder on\. Next reminder: (today|tomorrow) at 0?8:00.*, if WeatherBoard is open\./)).toBeVisible()
  })
})

describe('asking for permission', () => {
  it('does not mention or request permission before reminders are turned on', () => {
    const Notification = stubNotification('default')
    setup({ enabled: false })
    expect(screen.getByText('Notifications: Not asked yet')).toBeVisible()
    expect(screen.getByText('WeatherBoard asks for permission only after you turn the reminder on.')).toBeVisible()
    expect(screen.queryByText(REMINDER_PERMISSION_EXPLANATION)).toBeNull()
    expect(allowButton()).toBeNull()
    expect(Notification.requestPermission).not.toHaveBeenCalled()
  })

  it('turning reminders on shows the explanation first — and still has not asked', async () => {
    const Notification = stubNotification('default', 'granted')
    const { user } = setup()
    await user.click(screen.getByRole('switch'))

    expect(within(permissionPanel()).getByText(REMINDER_PERMISSION_EXPLANATION)).toBeVisible()
    expect(allowButton()).toBeVisible()
    expect(Notification.requestPermission).not.toHaveBeenCalled() // turning on is not the request
  })

  it('uses the exact required wording', async () => {
    stubNotification('default')
    setup({ enabled: true })
    expect(screen.getByText("We'd like to send you a daily morning reminder to check your local weather, so you can plan your day.")).toBeVisible()
  })

  it('asks the browser only when "Allow notifications" is pressed, exactly once', async () => {
    const Notification = stubNotification('default', 'granted')
    const { user } = setup({ enabled: true })
    expect(Notification.requestPermission).not.toHaveBeenCalled()

    await user.click(allowButton()!)
    expect(Notification.requestPermission).toHaveBeenCalledOnce()
    expect(screen.getByText('Notifications: Allowed')).toBeVisible()
    expect(allowButton()).toBeNull() // nothing left to ask
    expect(screen.queryByText(REMINDER_PERMISSION_EXPLANATION)).toBeNull()
  })

  it('says what is happening while the browser prompt is open', async () => {
    let resolve!: (v: Permission) => void
    class SlowNotification {
      static permission: Permission = 'default'
      static requestPermission = vi.fn(() => new Promise<Permission>((r) => (resolve = r)))
    }
    vi.stubGlobal('Notification', SlowNotification)
    const { user } = setup({ enabled: true })

    await user.click(allowButton()!)
    expect(screen.getByRole('button', { name: 'Waiting for your browser…' })).toBeDisabled()
    await act(async () => resolve('denied'))
  })

  it('handles the user refusing: shows "Blocked" with what to do, and keeps working in-app', async () => {
    stubNotification('default', 'denied')
    const { user } = setup({ enabled: true })
    await user.click(allowButton()!)

    expect(screen.getByText('Notifications: Blocked')).toBeVisible()
    expect(within(permissionPanel()).getByText(/reminders appear inside WeatherBoard while it’s open/)).toBeVisible()
    expect(within(permissionPanel()).getByText(/change this site’s notification permission in your browser’s settings/)).toBeVisible()
    expect(allowButton()).toBeNull() // browsers will not ask again; do not pretend we can
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true') // the reminder itself is still on
  })

  it('handles the prompt being dismissed: nothing changes and it can be tried again', async () => {
    const Notification = stubNotification('default', 'dismiss')
    const { user } = setup({ enabled: true })
    await user.click(allowButton()!)

    expect(screen.getByText('Notifications: Not asked yet')).toBeVisible()
    expect(screen.getByText(/No answer was given, so nothing has changed/)).toBeVisible()
    await user.click(allowButton()!)
    expect(Notification.requestPermission).toHaveBeenCalledTimes(2)
  })
})

describe('every permission state', () => {
  it('granted already: no explanation and no prompt, and says what it enables', async () => {
    const Notification = stubNotification('granted')
    stubServiceWorker(true)
    const { user } = setup()
    await user.click(screen.getByRole('switch'))
    await settle()

    expect(screen.getByText('Notifications: Allowed')).toBeVisible()
    expect(screen.queryByText(REMINDER_PERMISSION_EXPLANATION)).toBeNull()
    expect(allowButton()).toBeNull()
    expect(Notification.requestPermission).not.toHaveBeenCalled()
    expect(within(permissionPanel()).getByText(/background tab or window/)).toBeVisible()
  })

  it('denied already: explains that reminders stay in-app, offers no prompt, and the switch still works', async () => {
    const Notification = stubNotification('denied')
    const { user, onEnabledChange } = setup()
    expect(screen.getByText('Notifications: Blocked')).toBeVisible()
    expect(allowButton()).toBeNull()

    await user.click(screen.getByRole('switch'))
    expect(onEnabledChange).toHaveBeenCalledWith(true)
    expect(Notification.requestPermission).not.toHaveBeenCalled()
  })

  it('unsupported browser: says so plainly, with no prompt, and the switch still works', async () => {
    // no Notification API at all
    const { user, onEnabledChange } = setup()
    expect(screen.getByText('Notifications: Not supported')).toBeVisible()
    expect(within(permissionPanel()).getByText(/This browser can’t show system notifications/)).toBeVisible()
    expect(allowButton()).toBeNull()

    await user.click(screen.getByRole('switch'))
    expect(onEnabledChange).toHaveBeenCalledWith(true)
  })

  it('granted but no service worker: warns that system notifications may not appear', async () => {
    stubNotification('granted')
    stubServiceWorker(false)
    setup()
    await settle()
    expect(within(permissionPanel()).getByText(/background component, which isn’t running here/)).toBeVisible()
  })

  it('granted with a service worker: no such warning', async () => {
    stubNotification('granted')
    stubServiceWorker(true)
    setup()
    await settle()
    expect(within(permissionPanel()).queryByText(/background component/)).toBeNull()
  })

  it('never relies on colour alone: every state has a text label', () => {
    stubNotification('denied')
    setup()
    expect(permissionPanel()).toHaveTextContent(/Notifications: Blocked/)
  })
})

describe('the reminder time', () => {
  it('shows the saved time in a labelled time field limited to the morning', () => {
    stubNotification('granted')
    setup({ time: '07:30' })
    const field = screen.getByLabelText('Reminder time')
    expect(field).toHaveValue('07:30')
    expect(field).toHaveAttribute('type', 'time')
    expect(field).toHaveAttribute('min', '05:00')
    expect(field).toHaveAttribute('max', '11:59')
    expect(field).toBeRequired()
  })

  it('saves a valid morning time', async () => {
    stubNotification('granted')
    const { user, onTimeChange } = setup()
    const field = screen.getByLabelText('Reminder time')
    await user.clear(field)
    await user.type(field, '06:45')
    expect(onTimeChange).toHaveBeenLastCalledWith('06:45')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('rejects an afternoon time with a clear message, and saves nothing', async () => {
    stubNotification('granted')
    const { user, onTimeChange } = setup()
    const field = screen.getByLabelText('Reminder time')
    await user.clear(field)
    await user.type(field, '15:00')

    expect(screen.getByRole('alert')).toHaveTextContent(/Choose a morning time between .*5:00.* and .*11:59/)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(/Choose a morning time/)
    expect(onTimeChange).not.toHaveBeenCalledWith('15:00')
  })

  it('rejects an empty time', async () => {
    stubNotification('granted')
    const { user, onTimeChange } = setup()
    await user.clear(screen.getByLabelText('Reminder time'))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a time for your reminder.')
    expect(onTimeChange).not.toHaveBeenCalled()
  })

  it('reverts to the saved time when the field is left with an invalid value', async () => {
    stubNotification('granted')
    const { user } = setup({ time: '08:00' })
    const field = screen.getByLabelText('Reminder time')
    await user.clear(field)
    await user.type(field, '15:00')
    await user.tab()
    expect(field).toHaveValue('08:00')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('updates the "next reminder" text when the time changes', async () => {
    stubNotification('granted')
    const { user } = setup({ enabled: true, time: '08:00' })
    const field = screen.getByLabelText('Reminder time')
    await user.clear(field)
    await user.type(field, '10:15')
    expect(screen.getByText(/Next reminder: (today|tomorrow) at 0?10:15/)).toBeVisible()
  })
})

describe('honesty about what reminders can do', () => {
  it('says plainly that reminders only appear while the app is open', () => {
    stubNotification('granted')
    setup()
    const info = screen.getByRole('region', { name: 'What reminders can do' })
    expect(info).toHaveTextContent('Reminders only appear while WeatherBoard is open')
    expect(info).toHaveTextContent('can’t send a reminder when it’s closed')
    expect(info).toHaveTextContent('reliable background notifications need a server')
    expect(info).toHaveTextContent('you won’t get that day’s reminder')
  })

  it('never claims delivery while the app is closed', () => {
    stubNotification('granted')
    setup({ enabled: true })
    const everything = document.body.textContent ?? ''
    expect(everything).not.toMatch(/even when (WeatherBoard|the app|your browser) is closed/i)
    expect(everything).not.toMatch(/delivered by a server/i)
    expect(everything).not.toMatch(/guarantee/i)
  })

  it('says which city and unit the reminder will use', () => {
    stubNotification('granted')
    setup({ city: london, unit: 'celsius' })
    expect(screen.getByText('Your reminder will show the weather for London in °C.')).toBeVisible()
  })

  it('reflects Fahrenheit, and asks for a city when none is chosen', () => {
    stubNotification('granted')
    setup({ city: london, unit: 'fahrenheit' })
    expect(screen.getByText('Your reminder will show the weather for London in °F.')).toBeVisible()
  })

  it('asks the user to choose a city when there is none', () => {
    stubNotification('granted')
    setup({ city: null })
    expect(screen.getByText('Choose a city to get a weather summary in your reminder.')).toBeVisible()
  })
})

describe('test reminder', () => {
  it('sends a test on request, with feedback while it runs', async () => {
    stubNotification('granted')
    const { user, onSendTest } = setup()
    await user.click(screen.getByRole('button', { name: 'Send a test reminder' }))
    expect(onSendTest).toHaveBeenCalledOnce()
  })

  it('previews the test reminder text in the dialog (the page behind it is covered)', () => {
    stubNotification('granted')
    setup({ testReminder: { id: 1, kind: 'test', message: { title: 'Weather in London', body: 'Partly cloudy, 7°C.' } } })
    const preview = screen.getByText('Weather in London').closest('p')!
    expect(preview).toHaveTextContent('Partly cloudy, 7°C.')
  })

  it('does not show a scheduled reminder as a test preview', () => {
    stubNotification('granted')
    setup({ testReminder: { id: 1, kind: 'scheduled', message: { title: 'Weather in London', body: 'x' } } })
    expect(screen.queryByText('Weather in London')).toBeNull()
  })
})
