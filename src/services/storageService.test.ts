import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getStoredValue,
  isStoragePersistent,
  probeStorage,
  removeStoredValue,
  resetStorageStateForTests,
  setStoredValue,
  subscribeToStorageStatus,
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

describe('storage status notifications', () => {
  const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))

  it('notifies subscribers (asynchronously) when persistence is lost and when it returns', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToStorageStatus(listener)

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    setStoredValue('k', 'v')
    expect(listener).not.toHaveBeenCalled() // deferred, never synchronous
    await flush()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(isStoragePersistent()).toBe(false)

    setItem.mockRestore()
    setStoredValue('k', 'v')
    await flush()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(isStoragePersistent()).toBe(true)
    unsubscribe()
  })

  it('does not notify when the status has not changed, or after unsubscribing', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToStorageStatus(listener)
    setStoredValue('k', 'v')
    await flush()
    expect(listener).not.toHaveBeenCalled()

    unsubscribe()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    setStoredValue('k', 'v')
    await flush()
    expect(listener).not.toHaveBeenCalled()
  })

  it('a successful read does not hide a failing write', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    setStoredValue('k', 'v')
    expect(isStoragePersistent()).toBe(false)
    getStoredValue('missing', isString)
    expect(isStoragePersistent()).toBe(false)
  })

  it('probeStorage detects blocked writes up front, and recovery', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    probeStorage()
    expect(isStoragePersistent()).toBe(false)

    setItem.mockRestore()
    probeStorage()
    expect(isStoragePersistent()).toBe(true)
    expect(window.localStorage.getItem('weatherboard:__probe')).toBeNull() // cleaned up
  })
})
