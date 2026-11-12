import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getStoredValue,
  isStoragePersistent,
  removeStoredValue,
  resetStorageStateForTests,
  setStoredValue,
} from '@/services/storageService'

const isString = (v: unknown): v is string => typeof v === 'string'

beforeEach(() => resetStorageStateForTests())
afterEach(() => vi.restoreAllMocks())

describe('storageService', () => {
  it('round-trips a value under a namespaced key', () => {
    setStoredValue('k', 'v')
    expect(window.localStorage.getItem('weatherboard:k')).toBe('"v"')
    expect(getStoredValue('k', isString)).toBe('v')
  })

  it('returns the fallback when the key is absent', () => {
    expect(getStoredValue('missing', isString, 'default')).toBe('default')
    expect(getStoredValue('missing', isString)).toBeNull()
  })

  it('discards and removes corrupted JSON', () => {
    window.localStorage.setItem('weatherboard:k', '{not json')
    expect(getStoredValue('k', isString, 'default')).toBe('default')
    expect(window.localStorage.getItem('weatherboard:k')).toBeNull()
  })

  it('discards and removes values that fail validation', () => {
    window.localStorage.setItem('weatherboard:k', '42')
    expect(getStoredValue('k', isString, 'default')).toBe('default')
    expect(window.localStorage.getItem('weatherboard:k')).toBeNull()
  })

  it('removes values', () => {
    setStoredValue('k', 'v')
    removeStoredValue('k')
    expect(getStoredValue('k', isString)).toBeNull()
  })

  describe('when localStorage throws', () => {
    beforeEach(() => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
    })

    it('falls back to memory without throwing and reports non-persistence', () => {
      expect(() => setStoredValue('k', 'v')).not.toThrow()
      expect(getStoredValue('k', isString)).toBe('v')
      expect(isStoragePersistent()).toBe(false)
      expect(() => removeStoredValue('k')).not.toThrow()
      expect(getStoredValue('k', isString)).toBeNull()
    })
  })
})
