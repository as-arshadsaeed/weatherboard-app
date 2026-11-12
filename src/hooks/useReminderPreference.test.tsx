import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useReminderPreference } from '@/hooks/useReminderPreference'
import { isStoragePersistent, resetStorageStateForTests } from '@/services/storageService'

const stored = () => JSON.parse(window.localStorage.getItem('weatherboard:reminder') ?? 'null')
const at = (h: number, m = 0) => new Date(2026, 10, 13, h, m, 0, 0)

beforeEach(() => {
  resetStorageStateForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at(7, 0))
})
afterEach(() => vi.useRealTimers())

describe('useReminderPreference', () => {
  it('defaults to off, at 08:00, never fired', () => {
    const { result } = renderHook(() => useReminderPreference())
    expect(result.current.preference).toEqual({ enabled: false, time: '08:00', lastFiredOn: null })
  })

  it('persists changes and restores them after a reload (fresh mount)', () => {
    const first = renderHook(() => useReminderPreference())
    act(() => first.result.current.setEnabled(true))
    first.unmount()
    const second = renderHook(() => useReminderPreference())
    act(() => void second.result.current.setTime('07:30'))
    second.unmount()

    const third = renderHook(() => useReminderPreference())
    expect(third.result.current.preference).toMatchObject({ enabled: true, time: '07:30' })
    expect(stored()).toMatchObject({ enabled: true, time: '07:30' })
  })

  it.each(['{not json', '"on"', '42', JSON.stringify({ enabled: 'yes', time: '08:00', lastFiredOn: null }), JSON.stringify({ enabled: true, time: '99:99', lastFiredOn: null })])(
    'ignores a corrupted stored value (%s)',
    (raw) => {
      window.localStorage.setItem('weatherboard:reminder', raw)
      const { result } = renderHook(() => useReminderPreference())
      expect(result.current.preference).toEqual({ enabled: false, time: '08:00', lastFiredOn: null })
    },
  )

  describe('turning it on', () => {
    it('leaves today free to fire when today’s time is still ahead', () => {
      const { result } = renderHook(() => useReminderPreference())
      act(() => result.current.setEnabled(true)) // 07:00, reminder at 08:00
      expect(result.current.preference).toMatchObject({ enabled: true, lastFiredOn: null })
    })

    it('counts today as done when today’s time has already passed: no immediate reminder', () => {
      vi.setSystemTime(at(8, 10))
      const { result } = renderHook(() => useReminderPreference())
      act(() => result.current.setEnabled(true))
      expect(result.current.preference.lastFiredOn).toBe('2026-11-13')
    })

    it('turning it off keeps the rest of the preference', () => {
      const { result } = renderHook(() => useReminderPreference())
      act(() => void result.current.setTime('09:15'))
      act(() => result.current.setEnabled(true))
      act(() => result.current.setEnabled(false))
      expect(result.current.preference).toMatchObject({ enabled: false, time: '09:15' })
    })
  })

  describe('choosing a time', () => {
    it('accepts a morning time', () => {
      const { result } = renderHook(() => useReminderPreference())
      let accepted = false
      act(() => {
        accepted = result.current.setTime('06:45')
      })
      expect(accepted).toBe(true)
      expect(result.current.preference.time).toBe('06:45')
    })

    it.each(['', '04:59', '12:00', '18:00', '8:00', '25:00', 'soon'])('rejects "%s" and changes nothing', (time) => {
      const { result } = renderHook(() => useReminderPreference())
      let accepted = true
      act(() => {
        accepted = result.current.setTime(time)
      })
      expect(accepted).toBe(false)
      expect(result.current.preference.time).toBe('08:00')
      expect(stored()).toBeNull() // nothing was written
    })

    it('re-arms: moving the time to one already passed today skips today; a later one is free to fire', () => {
      vi.setSystemTime(at(8, 40))
      const { result } = renderHook(() => useReminderPreference())
      act(() => void result.current.setTime('08:30'))
      expect(result.current.preference.lastFiredOn).toBe('2026-11-13')
      act(() => void result.current.setTime('09:00'))
      expect(result.current.preference.lastFiredOn).toBeNull()
    })
  })

  describe('claimReminder (once per day, across tabs)', () => {
    it('lets the first caller show today’s reminder and refuses the second', () => {
      const { result } = renderHook(() => useReminderPreference())
      let first = false
      let second = true
      act(() => {
        first = result.current.claimReminder('2026-11-13')
      })
      act(() => {
        second = result.current.claimReminder('2026-11-13')
      })
      expect(first).toBe(true)
      expect(second).toBe(false)
      expect(stored().lastFiredOn).toBe('2026-11-13')
    })

    it('refuses when another tab already claimed today (it re-reads storage)', () => {
      const { result } = renderHook(() => useReminderPreference())
      window.localStorage.setItem('weatherboard:reminder', JSON.stringify({ enabled: true, time: '08:00', lastFiredOn: '2026-11-13' }))
      let claimed = true
      act(() => {
        claimed = result.current.claimReminder('2026-11-13')
      })
      expect(claimed).toBe(false)
    })

    it('allows the next day', () => {
      const { result } = renderHook(() => useReminderPreference())
      act(() => void result.current.claimReminder('2026-11-13'))
      let claimed = false
      act(() => {
        claimed = result.current.claimReminder('2026-11-14')
      })
      expect(claimed).toBe(true)
    })
  })

  it('keeps working in memory when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const { result } = renderHook(() => useReminderPreference())
    act(() => result.current.setEnabled(true))
    expect(result.current.preference.enabled).toBe(true)
    expect(isStoragePersistent()).toBe(false) // so the "will not be saved" notice appears
  })
})
