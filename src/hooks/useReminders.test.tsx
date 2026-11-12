import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useReminderPreference } from '@/hooks/useReminderPreference'
import { useReminders } from '@/hooks/useReminders'
import * as notifications from '@/services/notificationService'
import { loadReminderWeather } from '@/services/reminderWeather'
import { resetStorageStateForTests } from '@/services/storageService'
import { london, paris } from '@/test/cities'
import { buildReport } from '@/test/fixtures/report'
import type { City } from '@/types/city'
import type { TemperatureUnit } from '@/types/weather'

vi.mock('@/services/reminderWeather', () => ({ loadReminderWeather: vi.fn() }))
vi.mock('@/services/notificationService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/notificationService')>()),
  getNotificationPermission: vi.fn(() => 'denied'),
  isPageActive: vi.fn(() => true),
  showSystemNotification: vi.fn(async () => 'shown'),
}))

const weatherMock = vi.mocked(loadReminderWeather)
const showMock = vi.mocked(notifications.showSystemNotification)
const permissionMock = vi.mocked(notifications.getNotificationPermission)
const pageActiveMock = vi.mocked(notifications.isPageActive)

const at = (day: number, h: number, m = 0, s = 0) => new Date(2026, 10, day, h, m, s, 0)
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
const MINUTE = 60_000

type Props = { city: City | null; unit: TemperatureUnit }
/** The preference hook and the scheduler wired together, as the app does. */
function setup(initial: Props = { city: london, unit: 'celsius' }) {
  return renderHook(
    ({ city, unit }: Props) => {
      const prefs = useReminderPreference()
      const reminders = useReminders({ preference: prefs.preference, claimReminder: prefs.claimReminder, city, unit })
      return { ...prefs, ...reminders }
    },
    { initialProps: initial },
  )
}
const presetPreference = (enabled: boolean, time = '08:00', lastFiredOn: string | null = null) =>
  window.localStorage.setItem('weatherboard:reminder', JSON.stringify({ enabled, time, lastFiredOn }))

beforeEach(() => {
  resetStorageStateForTests()
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(at(13, 7, 59))
  weatherMock.mockResolvedValue({ report: buildReport(at(13, 7, 59).getTime(), 6.7), source: 'live' })
  permissionMock.mockReturnValue('denied')
  pageActiveMock.mockReturnValue(true)
  showMock.mockClear()
  weatherMock.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('when reminders are off', () => {
  it('never fires, however long the app stays open', async () => {
    const { result } = setup()
    await advance(48 * 60 * MINUTE)
    expect(result.current.reminder).toBeNull()
    expect(weatherMock).not.toHaveBeenCalled()
  })
})

describe('firing at the selected time while the app is open', () => {
  it('does not fire before the time, then fires within one check interval after it', async () => {
    presetPreference(true)
    const { result } = setup()
    await advance(20_000)
    expect(result.current.reminder).toBeNull() // 08:00 not reached yet

    await advance(60_000)
    expect(result.current.reminder).not.toBeNull()
    expect(result.current.reminder?.kind).toBe('scheduled')
  })

  it('shows the selected city’s weather in the selected unit', async () => {
    presetPreference(true)
    const { result } = setup({ city: london, unit: 'celsius' })
    await advance(2 * MINUTE)
    expect(result.current.reminder?.message.title).toBe('Weather in London')
    expect(result.current.reminder?.message.body).toContain('7°C')
    expect(weatherMock).toHaveBeenCalledWith(london)
  })

  it('uses the city and unit selected at the moment it fires, not when it was scheduled', async () => {
    presetPreference(true)
    const { result, rerender } = setup({ city: london, unit: 'celsius' })
    await advance(20_000)
    rerender({ city: paris, unit: 'fahrenheit' }) // the user changed their mind before 08:00
    await advance(2 * MINUTE)

    expect(weatherMock).toHaveBeenCalledWith(paris)
    expect(result.current.reminder?.message.title).toBe('Weather in Paris')
    expect(result.current.reminder?.message.body).toContain('44°F')
    expect(result.current.reminder?.message.body).not.toContain('°C')
  })

  it('fires once a day, and again the next day', async () => {
    presetPreference(true)
    const { result } = setup()
    await advance(2 * MINUTE)
    const first = result.current.reminder
    expect(first).not.toBeNull()

    act(() => result.current.dismissReminder())
    await advance(6 * 60 * MINUTE) // the rest of the morning: nothing more today
    expect(result.current.reminder).toBeNull()
    expect(weatherMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(at(14, 7, 59)) // next day
    await advance(2 * MINUTE)
    expect(result.current.reminder).not.toBeNull()
    expect(result.current.reminder?.id).not.toBe(first?.id)
    expect(weatherMock).toHaveBeenCalledTimes(2)
  })

  it('records that it fired, so a reload on the same day does not repeat it', async () => {
    presetPreference(true)
    const first = setup()
    await advance(2 * MINUTE)
    expect(first.result.current.reminder).not.toBeNull()
    first.unmount()

    weatherMock.mockClear()
    const reloaded = setup()
    await advance(5 * MINUTE)
    expect(reloaded.result.current.reminder).toBeNull()
    expect(weatherMock).not.toHaveBeenCalled()
  })

  it('stops when disabled, and does not fire after the app is closed (unmounted)', async () => {
    presetPreference(true)
    const { result, unmount } = setup()
    act(() => result.current.setEnabled(false))
    await advance(2 * MINUTE)
    expect(result.current.reminder).toBeNull()

    // Start a fresh "day": the clock is back before the reminder time, and the app is closed again at once.
    vi.setSystemTime(at(13, 7, 59))
    presetPreference(true)
    weatherMock.mockClear()
    const second = setup()
    second.unmount()
    await advance(2 * MINUTE)
    expect(weatherMock).not.toHaveBeenCalled()
    unmount()
  })

  it('does not fire when another tab already showed today’s reminder', async () => {
    presetPreference(true, '08:00', '2026-11-13')
    const { result } = setup()
    await advance(5 * MINUTE)
    expect(result.current.reminder).toBeNull()
  })

  it('catches up after the computer was asleep: a visibility/focus check fires an overdue reminder', async () => {
    presetPreference(true)
    const { result } = setup()
    vi.setSystemTime(at(13, 8, 12)) // woke up 12 minutes after the time; no timer ticked meanwhile
    act(() => void window.dispatchEvent(new Event('focus')))
    await advance(0)
    expect(result.current.reminder).not.toBeNull()
  })
})

describe('the grace window', () => {
  it('shows a reminder if the app is opened shortly after the time (within 30 minutes)', async () => {
    vi.setSystemTime(at(13, 8, 20))
    presetPreference(true)
    const { result } = setup()
    await advance(0)
    expect(result.current.reminder).not.toBeNull()
  })

  it('skips today’s reminder if the app was not open in time: no late reminder', async () => {
    vi.setSystemTime(at(13, 9, 0))
    presetPreference(true)
    const { result } = setup()
    await advance(10 * MINUTE)
    expect(result.current.reminder).toBeNull()
  })

  it('turning it on after the time has passed does not fire immediately', async () => {
    vi.setSystemTime(at(13, 8, 10))
    const { result } = setup()
    act(() => result.current.setEnabled(true))
    await advance(2 * MINUTE)
    expect(result.current.reminder).toBeNull()
  })

  it('changing the time to a later one today makes it fire at the new time', async () => {
    vi.setSystemTime(at(13, 7, 0))
    presetPreference(true)
    const { result } = setup()
    act(() => void result.current.setTime('09:00'))
    await advance(60 * MINUTE)
    expect(result.current.reminder).toBeNull() // 08:00 passed, but the time is now 09:00
    await advance(61 * MINUTE)
    expect(result.current.reminder).not.toBeNull()
  })
})

describe('content when data is missing', () => {
  it('does not invent weather when none could be loaded', async () => {
    presetPreference(true)
    weatherMock.mockResolvedValue(null)
    const { result } = setup()
    await advance(2 * MINUTE)
    expect(result.current.reminder?.message.body).toBe('Open WeatherBoard to check today’s weather in London.')
  })

  it('asks the user to pick a city when none is selected, without fetching anything', async () => {
    presetPreference(true)
    const { result } = setup({ city: null, unit: 'celsius' })
    await advance(2 * MINUTE)
    expect(result.current.reminder?.message.body).toBe('Open WeatherBoard and choose a city to see today’s weather.')
    expect(weatherMock).not.toHaveBeenCalled()
  })

  it('labels saved weather as saved', async () => {
    presetPreference(true)
    weatherMock.mockResolvedValue({ report: buildReport(at(13, 5, 0).getTime(), 6.7), source: 'saved' })
    const { result } = setup()
    await advance(2 * MINUTE)
    expect(result.current.reminder?.message.body).toMatch(/Saved weather from about 3 hours ago\.$/)
  })
})

describe('system notifications', () => {
  it('shows one when allowed and the page is not in front of the user', async () => {
    presetPreference(true)
    permissionMock.mockReturnValue('granted')
    pageActiveMock.mockReturnValue(false)
    const { result } = setup()
    await advance(2 * MINUTE)
    expect(showMock).toHaveBeenCalledOnce()
    expect(showMock).toHaveBeenCalledWith(result.current.reminder?.message)
  })

  it('does not duplicate the in-app banner while the user is looking at the page', async () => {
    presetPreference(true)
    permissionMock.mockReturnValue('granted')
    pageActiveMock.mockReturnValue(true)
    const { result } = setup()
    await advance(2 * MINUTE)
    expect(result.current.reminder).not.toBeNull() // the banner is the reminder
    expect(showMock).not.toHaveBeenCalled()
  })

  it.each(['default', 'denied', 'unsupported'] as const)('never shows one without permission (%s), but the in-app reminder still works', async (permission) => {
    presetPreference(true)
    permissionMock.mockReturnValue(permission)
    pageActiveMock.mockReturnValue(false)
    const { result } = setup()
    await advance(2 * MINUTE)
    expect(result.current.reminder).not.toBeNull()
    expect(showMock).not.toHaveBeenCalled()
  })
})

describe('test reminders', () => {
  it('shows a test reminder now, without changing today’s real reminder', async () => {
    presetPreference(true)
    const { result } = setup()
    await act(async () => void (await result.current.sendTestReminder()))
    expect(result.current.reminder?.kind).toBe('test')
    expect(result.current.preference.lastFiredOn).toBeNull() // the real reminder is still pending

    await advance(2 * MINUTE)
    expect(result.current.reminder?.kind).toBe('scheduled') // and it still fired at 08:00
  })

  it('works even when reminders are switched off', async () => {
    const { result } = setup()
    await act(async () => void (await result.current.sendTestReminder()))
    expect(result.current.reminder?.kind).toBe('test')
  })

  it('is also shown as a system notification when allowed, even with the page in front', async () => {
    permissionMock.mockReturnValue('granted')
    pageActiveMock.mockReturnValue(true)
    const { result } = setup()
    await act(async () => void (await result.current.sendTestReminder()))
    expect(showMock).toHaveBeenCalledOnce()
  })

  it('is not shown as a system notification without permission', async () => {
    permissionMock.mockReturnValue('denied')
    const { result } = setup()
    await act(async () => void (await result.current.sendTestReminder()))
    expect(showMock).not.toHaveBeenCalled()
    expect(result.current.reminder).not.toBeNull()
  })
})

describe('dismissing', () => {
  it('clears the in-app reminder', async () => {
    presetPreference(true)
    const { result } = setup()
    await advance(2 * MINUTE)
    act(() => result.current.dismissReminder())
    expect(result.current.reminder).toBeNull()
  })
})
