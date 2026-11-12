import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getNotificationPermission,
  isPageActive,
  shouldShowSystemNotification,
  showSystemNotification,
} from '@/services/notificationService'
import { loadReminderWeather } from '@/services/reminderWeather'
import type { City } from '@/types/city'
import type { ReminderPreference } from '@/types/preferences'
import type { TemperatureUnit } from '@/types/weather'
import { REMINDER_CHECK_INTERVAL_MS } from '@/utils/constants'
import { buildReminderMessage, isReminderDue, localDateKey, type ReminderMessage } from '@/utils/reminder'

export interface ActiveReminder {
  /** Changes for every reminder, so the UI can tell a new one from the same one. */
  id: number
  kind: 'scheduled' | 'test'
  message: ReminderMessage
}

interface UseRemindersOptions {
  preference: ReminderPreference
  /** Claim today's reminder (returns false if it already fired). */
  claimReminder: (dateKey: string) => boolean
  /** Read at the moment a reminder fires, so it reflects the current choices. */
  city: City | null
  unit: TemperatureUnit
}

/**
 * The in-app reminder scheduler. While WeatherBoard is open it checks every 30 s (and on focus, when it
 * becomes visible, and when the connection returns, because background tabs are throttled and laptops
 * sleep) whether today's reminder is due, and shows it. It cannot do anything while the app is closed.
 *
 * A reminder is always shown in the app; when permission is granted and the page is not in front of the
 * user it also becomes a system notification. Its text uses the city and unit selected at that moment.
 */
export function useReminders({ preference, claimReminder, city, unit }: UseRemindersOptions) {
  const [reminder, setReminder] = useState<ActiveReminder | null>(null)
  const latest = useRef({ city, unit })
  const counter = useRef(0)

  useEffect(() => {
    latest.current = { city, unit }
  }, [city, unit])

  const deliver = useCallback(async (kind: ActiveReminder['kind']) => {
    const { city: currentCity, unit: currentUnit } = latest.current
    const weather = currentCity ? await loadReminderWeather(currentCity) : null
    const message = buildReminderMessage({ city: currentCity, unit: currentUnit, weather })
    counter.current += 1
    setReminder({ id: counter.current, kind, message })

    const permission = getNotificationPermission()
    // A test is the user asking to see what a reminder looks like, so it is always shown as a system
    // notification when allowed. A scheduled one only when the page is not already in front of them.
    const show =
      kind === 'test'
        ? permission === 'granted'
        : shouldShowSystemNotification({ permission, pageActive: isPageActive() })
    if (show) await showSystemNotification(message)
  }, [])

  useEffect(() => {
    if (!preference.enabled) return

    const check = () => {
      const now = new Date()
      if (isReminderDue(now, preference) && claimReminder(localDateKey(now))) {
        void deliver('scheduled')
      }
    }
    const interval = window.setInterval(check, REMINDER_CHECK_INTERVAL_MS)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    check() // the app was just opened inside today's window, or the preference just changed

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [preference, claimReminder, deliver])

  const dismissReminder = useCallback(() => setReminder(null), [])
  const sendTestReminder = useCallback(() => deliver('test'), [deliver])

  return { reminder, dismissReminder, sendTestReminder }
}
