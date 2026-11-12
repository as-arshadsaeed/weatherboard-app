import { expect, test, type Page } from '@playwright/test'

import { asFavourite, LONDON, mockApis, panel, seed } from './support/app.ts'
import { waitForServiceWorkerControl } from './support/serviceWorker.ts'

const LONDON_URL = '/?lat=51.5085&lon=-0.1257&name=London&country=United%20Kingdom'
const PARIS = { id: 'geodb:2', name: 'Paris', country: 'France', latitude: 48.8534, longitude: 2.3488 }
const EXPLANATION = "We'd like to send you a daily morning reminder to check your local weather, so you can plan your day."

// A fixed timezone and locale so "07:58 / 8:00 AM" mean the same everywhere.
test.use({ timezoneId: 'Europe/London', locale: 'en-US' })

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' })
const permissionPanel = (page: Page) => dialog(page).getByRole('region', { name: 'Notification permission' })
const reminderSwitch = (page: Page) => dialog(page).getByRole('switch', { name: 'Daily weather reminder' })
const timeField = (page: Page) => dialog(page).getByLabel('Reminder time')
const dailyBanner = (page: Page) => page.getByRole('status', { name: 'Daily weather reminder' })
const testBanner = (page: Page) => page.getByRole('status', { name: 'Test reminder' })

async function openSettings(page: Page) {
  const width = page.viewportSize()!.width
  const entry =
    width < 768
      ? page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' })
      : page.getByRole('banner').getByRole('button', { name: 'Settings' })
  await entry.click()
  await expect(dialog(page)).toBeVisible()
}
const closeSettings = (page: Page) => dialog(page).getByRole('button', { name: 'Close settings' }).click()

interface PermissionStub {
  initial: 'default' | 'granted' | 'denied'
  /** What the browser prompt returns when asked. */
  answer: 'granted' | 'denied' | 'dismiss'
}

/** Replace Notification with a controllable stand-in that counts prompts and records what was shown. */
async function stubPermission(page: Page, { initial, answer }: PermissionStub) {
  await page.addInitScript(
    ([initialPermission, promptAnswer]) => {
      const state = { permission: initialPermission as string, requests: 0, shown: [] as Array<{ title: string; body?: string }> }
      ;(window as unknown as Record<string, unknown>).__notification = state
      class FakeNotification {
        static get permission() {
          return state.permission
        }
        static requestPermission() {
          state.requests++
          if (promptAnswer === 'dismiss') return Promise.resolve('default')
          state.permission = promptAnswer as string
          return Promise.resolve(promptAnswer)
        }
        constructor(title: string, options?: NotificationOptions) {
          state.shown.push({ title, body: options?.body })
        }
      }
      ;(window as unknown as Record<string, unknown>).Notification = FakeNotification
    },
    [initial, answer] as const,
  )
}
const promptCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __notification: { requests: number } }).__notification.requests)

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

const storedReminder = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('weatherboard:reminder') ?? 'null'))

test.describe('settings access', () => {
  test('desktop: the header Settings button opens a labelled dialog; Escape closes it and returns focus', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    const button = page.getByRole('banner').getByRole('button', { name: 'Settings' })
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    await button.focus()
    await page.keyboard.press('Enter')

    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(button).toBeFocused()
  })

  test('the dialog is modal: focus cannot reach the page behind it', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    const unsafe = async () =>
      page.evaluate(() => {
        const active = document.activeElement
        return !!active && active !== document.body && active.closest('dialog') === null
      })
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await unsafe(), `after Tab #${i + 1}`).toBe(false)
    }
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('the header has no Settings button (no room); the bottom bar Settings tab opens the dialog', async ({ page }) => {
      await mockApis(page)
      await page.goto('/')
      await expect(page.getByRole('banner').getByRole('button', { name: 'Settings' })).toBeHidden()
      const tab = page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' })
      await expect(tab).toBeVisible()
      await expect(tab).toHaveAttribute('aria-haspopup', 'dialog')
      const box = (await tab.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
      await tab.click()
      await expect(dialog(page)).toBeVisible()
    })

    test('the Settings tab is never marked as the current view', async ({ page }) => {
      await mockApis(page)
      await page.goto('/')
      await openSettings(page)
      await closeSettings(page)
      const nav = page.getByRole('navigation', { name: 'Main' })
      await expect(nav.getByRole('button', { name: 'Settings' })).not.toHaveAttribute('aria-current')
      await expect(nav.getByRole('button', { name: /^Weather/ })).toHaveAttribute('aria-current', 'page')
    })
  })
})

test.describe('permission flow', () => {
  test('nothing asks for permission until the user presses "Allow notifications"', async ({ page }) => {
    const errors = trackErrors(page)
    await stubPermission(page, { initial: 'default', answer: 'granted' })
    await mockApis(page)
    await page.goto(LONDON_URL)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    expect(await promptCount(page)).toBe(0) // page load

    await openSettings(page)
    expect(await promptCount(page)).toBe(0) // opening settings
    await expect(permissionPanel(page)).toContainText('Notifications: Not asked yet')
    await expect(permissionPanel(page)).toContainText('asks for permission only after you turn the reminder on')
    await expect(dialog(page).getByText(EXPLANATION)).toHaveCount(0)

    await reminderSwitch(page).click()
    expect(await promptCount(page)).toBe(0) // turning the reminder on is not the request
    await expect(dialog(page).getByText(EXPLANATION, { exact: true })).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Allow notifications' })).toBeVisible()

    await dialog(page).getByRole('button', { name: 'Allow notifications' }).click()
    expect(await promptCount(page)).toBe(1)
    await expect(permissionPanel(page)).toContainText('Notifications: Allowed')
    await expect(dialog(page).getByText(EXPLANATION)).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('the user refuses: "Blocked", what to do, reminders stay on in-app, the dashboard is untouched', async ({ page }) => {
    const errors = trackErrors(page)
    await stubPermission(page, { initial: 'default', answer: 'denied' })
    await mockApis(page)
    await page.goto(LONDON_URL)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await openSettings(page)
    await reminderSwitch(page).click()
    await dialog(page).getByRole('button', { name: 'Allow notifications' }).click()

    await expect(permissionPanel(page)).toContainText('Notifications: Blocked')
    await expect(permissionPanel(page)).toContainText('reminders appear inside WeatherBoard while it’s open')
    await expect(permissionPanel(page)).toContainText('change this site’s notification permission in your browser’s settings')
    await expect(dialog(page).getByRole('button', { name: 'Allow notifications' })).toHaveCount(0)
    await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')
    expect((await storedReminder(page)).enabled).toBe(true)

    await closeSettings(page)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible() // dashboard still fine
    await expect(page.getByRole('combobox', { name: 'Search for a city' })).toBeEnabled()
    expect(errors).toEqual([])
  })

  test('a dismissed prompt changes nothing and can be retried', async ({ page }) => {
    await stubPermission(page, { initial: 'default', answer: 'dismiss' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await reminderSwitch(page).click()
    await dialog(page).getByRole('button', { name: 'Allow notifications' }).click()
    await expect(permissionPanel(page)).toContainText('No answer was given, so nothing has changed')
    await expect(permissionPanel(page)).toContainText('Notifications: Not asked yet')
    await dialog(page).getByRole('button', { name: 'Allow notifications' }).click()
    expect(await promptCount(page)).toBe(2)
  })

  test('already allowed: no explanation and no prompt', async ({ page }) => {
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await reminderSwitch(page).click()
    await expect(permissionPanel(page)).toContainText('Notifications: Allowed')
    await expect(dialog(page).getByText(EXPLANATION)).toHaveCount(0)
    await expect(dialog(page).getByRole('button', { name: 'Allow notifications' })).toHaveCount(0)
    expect(await promptCount(page)).toBe(0)
  })

  test('already blocked: says so, offers no prompt, and reminders can still be turned on (in-app)', async ({ page }) => {
    await stubPermission(page, { initial: 'denied', answer: 'denied' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await expect(permissionPanel(page)).toContainText('Notifications: Blocked')
    await expect(dialog(page).getByRole('button', { name: 'Allow notifications' })).toHaveCount(0)
    await reminderSwitch(page).click()
    await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')
    expect(await promptCount(page)).toBe(0)
  })

  test('unsupported browser: a clear message, no prompt, reminders still available in-app, no errors', async ({ page }) => {
    const errors = trackErrors(page)
    await page.addInitScript(() => {
      delete (window as unknown as Record<string, unknown>).Notification
    })
    await mockApis(page)
    await page.goto(LONDON_URL)
    await openSettings(page)
    await expect(permissionPanel(page)).toContainText('Notifications: Not supported')
    await expect(permissionPanel(page)).toContainText('This browser can’t show system notifications')
    await expect(dialog(page).getByRole('button', { name: 'Allow notifications' })).toHaveCount(0)

    await reminderSwitch(page).click()
    await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')
    await dialog(page).getByRole('button', { name: 'Send a test reminder' }).click()
    await closeSettings(page)
    await expect(testBanner(page)).toContainText('Weather in London') // the in-app fallback works
    expect(errors).toEqual([])
  })

  test('allowed and a service worker available: "Allowed" with no worker warning', async ({ page }) => {
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto('/')
    await waitForServiceWorkerControl(page)
    await openSettings(page)
    await expect(permissionPanel(page)).toContainText('Notifications: Allowed')
    await expect(permissionPanel(page)).not.toContainText('background component')
  })
})

test.describe('preferences', () => {
  test('the switch and the time are remembered after a reload', async ({ page }) => {
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await reminderSwitch(page).click()
    await timeField(page).fill('07:15')
    await expect(dialog(page).getByText(/Next reminder: (today|tomorrow) at 7:15 AM/)).toBeVisible()
    expect(await storedReminder(page)).toMatchObject({ enabled: true, time: '07:15' })

    await page.reload()
    await openSettings(page)
    await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')
    await expect(timeField(page)).toHaveValue('07:15')
  })

  test('an afternoon or empty time is rejected with a message and not saved', async ({ page }) => {
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await timeField(page).fill('15:00')
    await expect(dialog(page).getByRole('alert')).toContainText('Choose a morning time between 5:00 AM and 11:59 AM.')
    await expect(timeField(page)).toHaveAttribute('aria-invalid', 'true')
    expect(await storedReminder(page)).toBeNull()

    await timeField(page).fill('')
    await expect(dialog(page).getByRole('alert')).toContainText('Enter a time for your reminder.')
    expect(await storedReminder(page)).toBeNull()

    await timeField(page).fill('09:30')
    await expect(dialog(page).getByRole('alert')).toHaveCount(0)
    expect(await storedReminder(page)).toMatchObject({ time: '09:30' })
  })

  test('a corrupted saved preference falls back to the defaults without errors', async ({ page }) => {
    const errors = trackErrors(page)
    await seed(page, 'reminder', '{definitely not json')
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
    await expect(timeField(page)).toHaveValue('08:00')
    expect(errors).toEqual([])
  })

  test('with localStorage blocked it works for the session and shows the "will not be saved" notice', async ({ page }) => {
    await page.addInitScript(() => {
      const deny = () => {
        throw new DOMException('blocked', 'SecurityError')
      }
      Storage.prototype.getItem = deny
      Storage.prototype.setItem = deny
      Storage.prototype.removeItem = deny
    })
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await reminderSwitch(page).click()
    await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')
    await closeSettings(page)
    await expect(page.getByText('Settings can’t be saved.')).toBeVisible()
  })
})

test.describe('honest limits', () => {
  test('always says reminders only work while the app is open, and never promises more', async ({ page }) => {
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto('/')
    await openSettings(page)
    await reminderSwitch(page).click()
    const info = dialog(page).getByRole('region', { name: 'What reminders can do' })
    await expect(info).toContainText('Reminders only appear while WeatherBoard is open')
    await expect(info).toContainText('can’t send a reminder when it’s closed')
    await expect(info).toContainText('reliable background notifications need a server')
    await expect(info).toContainText('you won’t get that day’s reminder')
    const text = (await dialog(page).innerText()).toLowerCase()
    expect(text).not.toMatch(/even when (weatherboard|the app|your browser) is closed/)
    expect(text).not.toMatch(/guarantee/)
  })

  test('states which city and unit the reminder will use', async ({ page }) => {
    await stubPermission(page, { initial: 'granted', answer: 'granted' })
    await mockApis(page)
    await page.goto(LONDON_URL)
    await page.getByRole('button', { name: 'Fahrenheit (°F)' }).click()
    await openSettings(page)
    await expect(dialog(page).getByText('Your reminder will show the weather for London in °F.')).toBeVisible()
  })

  test('the generated worker handles notification clicks (focus or open the app)', async ({ page }) => {
    await page.goto('/')
    const script = await (await page.request.get('/sw-notifications.js')).text()
    expect(script).toContain('notificationclick')
    expect(script).toContain('clients.openWindow')
    const worker = await (await page.request.get('/sw.js')).text()
    expect(worker).toContain('sw-notifications.js')
  })
})

test.describe('a reminder fires while the app is open', () => {
  const CLOCK_START = '2026-11-13T07:58:00Z' // 07:58 in Europe/London (GMT in November)

  async function startAt(page: Page, time: string, preference: { enabled: boolean; time?: string; lastFiredOn?: string | null } = { enabled: true }) {
    await page.clock.install({ time: new Date(time) })
    await seed(page, 'reminder', { enabled: preference.enabled, time: preference.time ?? '08:00', lastFiredOn: preference.lastFiredOn ?? null })
    await stubPermission(page, { initial: 'denied', answer: 'denied' })
    await mockApis(page)
    await page.goto(LONDON_URL)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
  }

  test('shows the selected city’s weather in the selected unit at the chosen time — once a day', async ({ page }) => {
    const errors = trackErrors(page)
    await startAt(page, CLOCK_START)
    await expect(dailyBanner(page)).toHaveCount(0) // 07:58: not yet

    await page.clock.fastForward('03:00') // 08:01
    await expect(dailyBanner(page)).toBeVisible()
    await expect(dailyBanner(page)).toContainText('Weather in London')
    await expect(dailyBanner(page)).toContainText('Partly cloudy, 7°C, feels like 3°C')
    await expect(dailyBanner(page)).toContainText('Today: high 8°C, low 5°C, 0% chance of precipitation')

    await page.getByRole('button', { name: 'Dismiss reminder' }).click()
    await page.clock.fastForward('06:00:00') // the rest of the morning
    await expect(dailyBanner(page)).toHaveCount(0) // not again today

    await page.clock.fastForward('18:00:00') // next morning, 08:01
    await expect(dailyBanner(page)).toBeVisible() // …but again tomorrow
    expect(errors).toEqual([])
  })

  test('uses the city and unit chosen at that moment, not the ones from when it was enabled', async ({ page }) => {
    await seed(page, 'favourites', [asFavourite(LONDON), PARIS])
    await startAt(page, CLOCK_START)
    await page.getByRole('button', { name: 'Fahrenheit (°F)' }).click()
    await panel(page).getByRole('button', { name: /^Paris/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: /Paris/ })).toBeVisible()

    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toContainText('Weather in Paris')
    await expect(dailyBanner(page)).toContainText('44°F')
    await expect(dailyBanner(page)).not.toContainText('°C')
  })

  test('does nothing while reminders are off', async ({ page }) => {
    await startAt(page, CLOCK_START, { enabled: false })
    await page.clock.fastForward('03:00')
    await page.clock.fastForward('24:00:00')
    await expect(dailyBanner(page)).toHaveCount(0)
  })

  test('a reload on the same day does not repeat a reminder that already fired', async ({ page }) => {
    await startAt(page, CLOCK_START)
    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await page.clock.fastForward('01:00')
    await expect(dailyBanner(page)).toHaveCount(0)
  })

  test('opening the app shortly after the time (within 30 minutes) still shows today’s reminder', async ({ page }) => {
    await startAt(page, '2026-11-13T08:20:00Z')
    await expect(dailyBanner(page)).toBeVisible()
  })

  test('opening the app after the window skips today’s reminder: it is never sent late', async ({ page }) => {
    await startAt(page, '2026-11-13T09:00:00Z')
    await page.clock.fastForward('10:00')
    await expect(dailyBanner(page)).toHaveCount(0)
  })

  test('turning it on after today’s time has passed does not fire immediately', async ({ page }) => {
    await startAt(page, '2026-11-13T08:10:00Z', { enabled: false })
    await openSettings(page)
    await reminderSwitch(page).click()
    await closeSettings(page)
    await page.clock.fastForward('01:00')
    await expect(dailyBanner(page)).toHaveCount(0)
    await expect(page.getByText('Settings can’t be saved.')).toHaveCount(0)
  })

  test('works offline, using the saved forecast and saying so', async ({ page, context }) => {
    await startAt(page, CLOCK_START)
    await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === 'weatherboard'))).toBe(true)
    await page.waitForTimeout(300) // the forecast is saved in the background
    await waitForServiceWorkerControl(page)
    await context.setOffline(true)
    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toBeVisible()
    await expect(dailyBanner(page)).toContainText('Partly cloudy, 7°C')
    await expect(dailyBanner(page)).toContainText('Saved weather from')
  })

  test('with no city selected it asks the user to choose one, without inventing weather', async ({ page }) => {
    await page.clock.install({ time: new Date(CLOCK_START) })
    await seed(page, 'reminder', { enabled: true, time: '08:00', lastFiredOn: null })
    await stubPermission(page, { initial: 'denied', answer: 'denied' })
    await mockApis(page)
    await page.goto('/')
    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toContainText('Open WeatherBoard and choose a city to see today’s weather.')
  })

  test('a test reminder shows now, in the dialog and as a banner, without using up today’s real one', async ({ page }) => {
    await startAt(page, CLOCK_START)
    await openSettings(page)
    await dialog(page).getByRole('button', { name: 'Send a test reminder' }).click()
    await expect(dialog(page).getByText('Weather in London')).toBeVisible() // previewed in the dialog
    await closeSettings(page)
    await expect(testBanner(page)).toBeVisible()

    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toBeVisible() // the real one still fired
  })
})

test.describe('system notifications (real service worker registration)', () => {
  // Headless Chromium reports Notification.permission as "denied" even after grantPermissions, and
  // registration.showNotification then refuses, so the OS-level popup cannot be automated here. These
  // tests therefore record the call the app makes on the REAL service worker registration (title, body,
  // tag, icon) and check the decision logic around it. The popup itself needs a manual check in a headed browser.
  const START = '2026-11-13T07:58:00Z'

  async function setup(page: Page, { pageActive, permission = 'granted' }: { pageActive: boolean; permission?: 'granted' | 'denied' | 'default' }) {
    await stubPermission(page, { initial: permission, answer: permission === 'default' ? 'denied' : permission })
    await page.addInitScript(() => {
      const calls: Array<{ title: string; body?: string; tag?: string; icon?: string; data?: unknown }> = []
      ;(window as unknown as Record<string, unknown>).__workerNotifications = calls
      ServiceWorkerRegistration.prototype.showNotification = function (title: string, options?: NotificationOptions) {
        calls.push({ title, body: options?.body, tag: options?.tag, icon: options?.icon, data: options?.data })
        return Promise.resolve()
      }
    })
    if (!pageActive) {
      await page.addInitScript(() => {
        Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true })
        document.hasFocus = () => false
      })
    }
    await page.clock.install({ time: new Date(START) })
    await seed(page, 'reminder', { enabled: true, time: '08:00', lastFiredOn: null })
    await mockApis(page)
    await page.goto(LONDON_URL)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await waitForServiceWorkerControl(page)
  }
  const workerCalls = (page: Page) =>
    page.evaluate(() => (window as unknown as { __workerNotifications: Array<{ title: string; body?: string; tag?: string; icon?: string; data?: unknown }> }).__workerNotifications)

  test('a reminder while the page is in the background is also sent through the worker, for the selected city and unit', async ({ page }) => {
    await setup(page, { pageActive: false })
    await page.getByRole('button', { name: 'Fahrenheit (°F)' }).click()
    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toBeVisible() // the in-app reminder is always there too

    await expect.poll(async () => (await workerCalls(page)).length).toBe(1)
    const [call] = await workerCalls(page)
    expect(call).toMatchObject({
      title: 'Weather in London',
      tag: 'weatherboard-daily-reminder',
      icon: '/icons/icon-192.png',
      data: { url: '/' },
    })
    expect(call!.body).toContain('44°F')
    expect(call!.body).not.toContain('°C')
  })

  test('no duplicate system notification while the user is looking at the page', async ({ page }) => {
    await setup(page, { pageActive: true })
    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toBeVisible()
    await page.waitForTimeout(500)
    expect(await workerCalls(page)).toHaveLength(0)
  })

  test('no system notification without permission, but the in-app reminder still appears', async ({ page }) => {
    await setup(page, { pageActive: false, permission: 'denied' })
    await page.clock.fastForward('03:00')
    await expect(dailyBanner(page)).toBeVisible()
    await page.waitForTimeout(500)
    expect(await workerCalls(page)).toHaveLength(0)
  })

  test('a test reminder is also sent as a system notification when allowed, even with the page in front', async ({ page }) => {
    await setup(page, { pageActive: true })
    await openSettings(page)
    await dialog(page).getByRole('button', { name: 'Send a test reminder' }).click()
    await expect.poll(async () => (await workerCalls(page)).length).toBe(1)
  })
})

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`settings layout: ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const mode of ['light', 'dark'] as const) {
      test(`fits the viewport with 44 px controls in the ${mode} theme`, async ({ page }, testInfo) => {
        const errors = trackErrors(page)
        await stubPermission(page, { initial: 'default', answer: 'granted' })
        await mockApis(page)
        await page.goto(LONDON_URL)
        if (mode === 'dark') await page.getByRole('button', { name: /switch to dark/i }).click()
        await openSettings(page)
        await reminderSwitch(page).click() // reveals the explanation and the Allow button too

        const box = (await dialog(page).boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
        expect(sw).toBeLessThanOrEqual(cw)

        if (vp.width < 768) {
          for (const target of [
            reminderSwitch(page),
            timeField(page),
            dialog(page).getByRole('button', { name: 'Allow notifications' }),
            dialog(page).getByRole('button', { name: 'Send a test reminder' }),
            dialog(page).getByRole('button', { name: 'Close settings' }),
          ]) {
            await target.scrollIntoViewIfNeeded()
            const b = (await target.boundingBox())!
            expect(b.height, 'touch target height').toBeGreaterThanOrEqual(44)
            expect(b.width, 'touch target width').toBeGreaterThanOrEqual(44)
          }
        }
        await timeField(page).scrollIntoViewIfNeeded()
        await page.mouse.move(0, 0)
        if (process.env.SCREENSHOT_DIR) {
          await dialog(page).evaluate((el) => el.scrollTo(0, 0))
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/settings-${vp.name}-${mode}.png` })
        }
        expect(errors, testInfo.title).toEqual([])
      })
    }
  })
}
