import { useCallback, useState } from 'react'

import { getStoredValue, setStoredValue } from '@/services/storageService'
import { isReminderPreference, type ReminderPreference } from '@/types/preferences'
import { DEFAULT_REMINDER_TIME } from '@/utils/constants'
import { armedLastFiredOn, isValidReminderTime } from '@/utils/reminder'

export const REMINDER_STORAGE_KEY = 'reminder'

export const DEFAULT_REMINDER_PREFERENCE: ReminderPreference = {
  enabled: false,
  time: DEFAULT_REMINDER_TIME,
  lastFiredOn: null,
}

/**
 * The daily-reminder preference, persisted in localStorage (with the shared in-memory fallback when
 * storage is unavailable). Corrupt stored values are ignored.
 */
export function useReminderPreference() {
  const [preference, setPreference] = useState<ReminderPreference>(() =>
    getStoredValue(REMINDER_STORAGE_KEY, isReminderPreference, DEFAULT_REMINDER_PREFERENCE),
  )

  const save = useCallback((next: ReminderPreference) => {
    setPreference(next)
    setStoredValue(REMINDER_STORAGE_KEY, next)
  }, [])

  /** Switching on counts today as done if today's time has passed, so it never fires immediately. */
  const setEnabled = useCallback(
    (enabled: boolean) => {
      save({
        ...preference,
        enabled,
        lastFiredOn: enabled ? armedLastFiredOn(new Date(), preference.time) : preference.lastFiredOn,
      })
    },
    [preference, save],
  )

  /** Returns false (and changes nothing) for a time outside the selectable morning range. */
  const setTime = useCallback(
    (time: string): boolean => {
      if (!isValidReminderTime(time)) return false
      save({ ...preference, time, lastFiredOn: armedLastFiredOn(new Date(), time) })
      return true
    },
    [preference, save],
  )

  /**
   * Claim today's reminder. Re-reads storage so a second open tab that already fired it wins, and a
   * reminder can never fire twice in a day. Returns true if this caller should show it.
   */
  const claimReminder = useCallback(
    (dateKey: string): boolean => {
      const stored = getStoredValue(REMINDER_STORAGE_KEY, isReminderPreference, null)
      if (stored?.lastFiredOn === dateKey) return false
      save({ ...(stored ?? preference), lastFiredOn: dateKey })
      return true
    },
    [preference, save],
  )

  return { preference, setEnabled, setTime, claimReminder }
}
