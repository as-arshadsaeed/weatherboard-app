import { describe, expect, it } from 'vitest'

import { isReminderPreference } from '@/types/preferences'

describe('isReminderPreference', () => {
  it('accepts valid preferences', () => {
    expect(isReminderPreference({ enabled: true, time: '08:00', lastFiredOn: null })).toBe(true)
    expect(isReminderPreference({ enabled: false, time: '23:59', lastFiredOn: '2026-11-13' })).toBe(true)
    expect(isReminderPreference({ enabled: false, time: '00:00', lastFiredOn: null })).toBe(true)
  })

  it.each([
    ['null', null],
    ['a string', 'on'],
    ['missing enabled', { time: '08:00', lastFiredOn: null }],
    ['non-boolean enabled', { enabled: 'yes', time: '08:00', lastFiredOn: null }],
    ['missing time', { enabled: true, lastFiredOn: null }],
    ['a bad time (24:00)', { enabled: true, time: '24:00', lastFiredOn: null }],
    ['a bad time (8:00)', { enabled: true, time: '8:00', lastFiredOn: null }],
    ['a bad time (08:60)', { enabled: true, time: '08:60', lastFiredOn: null }],
    ['a bad date', { enabled: true, time: '08:00', lastFiredOn: 'yesterday' }],
    ['an undefined lastFiredOn', { enabled: true, time: '08:00' }],
  ])('rejects %s', (_label, value) => {
    expect(isReminderPreference(value)).toBe(false)
  })
})
