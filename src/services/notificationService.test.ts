import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getNotificationPermission,
  hasServiceWorkerRegistration,
  isNotificationSupported,
  isPageActive,
  REMINDER_DELIVERY,
  requestNotificationPermission,
  shouldShowSystemNotification,
  showSystemNotification,
} from '@/services/notificationService'

type Permission = 'default' | 'granted' | 'denied'

/** A controllable stand-in for the browser's Notification API. */
function stubNotification(permission: Permission, requestResult?: Permission | 'throw' | 'undefined') {
  const constructed: Array<{ title: string; options?: NotificationOptions }> = []
  const requestPermission = vi.fn(async () => {
    if (requestResult === 'throw') throw new Error('blocked')
    if (requestResult === 'undefined') return undefined
    return requestResult ?? permission
  })
  class FakeNotification {
    static permission: Permission = permission
    static requestPermission = requestPermission
    constructor(title: string, options?: NotificationOptions) {
      constructed.push({ title, options })
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  return { constructed, requestPermission, FakeNotification }
}

function stubWorkerRegistration(showNotification: ReturnType<typeof vi.fn> | null) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn(async () => (showNotification ? { showNotification } : undefined)) },
  })
}
const removeServiceWorker = () => delete (navigator as unknown as Record<string, unknown>).serviceWorker

const message = { title: 'Weather in London', body: 'Partly cloudy, 7°C.' }

beforeEach(() => removeServiceWorker())
afterEach(() => {
  vi.unstubAllGlobals()
  removeServiceWorker()
})

describe('the delivery promise', () => {
  it('honestly says reminders are in-app only and cannot arrive when the app is closed', () => {
    expect(REMINDER_DELIVERY).toEqual({ kind: 'in-app', backgroundDelivery: false })
  })
})

describe('support and permission state', () => {
  it('reports "unsupported" when the browser has no Notification API', () => {
    expect(isNotificationSupported()).toBe(false)
    expect(getNotificationPermission()).toBe('unsupported')
  })

  it.each(['default', 'granted', 'denied'] as const)('reports the browser permission "%s"', (permission) => {
    stubNotification(permission)
    expect(isNotificationSupported()).toBe(true)
    expect(getNotificationPermission()).toBe(permission)
  })

  it('treats an unknown permission value as "default"', () => {
    vi.stubGlobal('Notification', { permission: 'prompt' })
    expect(getNotificationPermission()).toBe('default')
  })
})

describe('requestNotificationPermission', () => {
  it('does nothing in an unsupported browser', async () => {
    expect(await requestNotificationPermission()).toBe('unsupported')
  })

  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['default', 'default'], // the prompt was dismissed
  ] as const)('maps a "%s" answer', async (answer, expected) => {
    const { requestPermission } = stubNotification('default', answer)
    expect(await requestNotificationPermission()).toBe(expected)
    expect(requestPermission).toHaveBeenCalledOnce()
  })

  it('never throws: falls back to the current permission', async () => {
    stubNotification('denied', 'throw')
    expect(await requestNotificationPermission()).toBe('denied')
  })

  it('reads the property when an old browser returns nothing from the promise', async () => {
    const { FakeNotification } = stubNotification('default', 'undefined')
    FakeNotification.permission = 'granted'
    expect(await requestNotificationPermission()).toBe('granted')
  })

  it('is never called by merely reading state', () => {
    const { requestPermission } = stubNotification('default')
    getNotificationPermission()
    isNotificationSupported()
    expect(requestPermission).not.toHaveBeenCalled()
  })
})

describe('shouldShowSystemNotification', () => {
  it('only when permission is granted and the page is not in front of the user', () => {
    expect(shouldShowSystemNotification({ permission: 'granted', pageActive: false })).toBe(true)
    expect(shouldShowSystemNotification({ permission: 'granted', pageActive: true })).toBe(false)
    for (const permission of ['default', 'denied', 'unsupported'] as const) {
      expect(shouldShowSystemNotification({ permission, pageActive: false })).toBe(false)
    }
  })

  it('isPageActive needs a visible AND focused page', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    expect(isPageActive()).toBe(true)
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    expect(isPageActive()).toBe(false)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    expect(isPageActive()).toBe(false)
  })
})

describe('showSystemNotification', () => {
  it('does nothing in an unsupported browser', async () => {
    expect(await showSystemNotification(message)).toBe('unsupported')
  })

  it.each(['default', 'denied'] as const)('shows nothing without permission (%s)', async (permission) => {
    const { constructed } = stubNotification(permission)
    const show = vi.fn()
    stubWorkerRegistration(show)
    expect(await showSystemNotification(message)).toBe('no-permission')
    expect(show).not.toHaveBeenCalled()
    expect(constructed).toHaveLength(0)
  })

  it('shows through the service worker, with the app icon and a replace-not-stack tag', async () => {
    const { constructed } = stubNotification('granted')
    const show = vi.fn(async () => {})
    stubWorkerRegistration(show)

    expect(await showSystemNotification(message)).toBe('shown')
    expect(show).toHaveBeenCalledWith('Weather in London', expect.objectContaining({
      body: 'Partly cloudy, 7°C.',
      icon: '/icons/icon-192.png',
      tag: 'weatherboard-daily-reminder',
      data: { url: '/' },
    }))
    expect(constructed).toHaveLength(0) // the worker path was used, not the constructor
  })

  it('falls back to the Notification constructor when no worker is registered', async () => {
    const { constructed } = stubNotification('granted')
    stubWorkerRegistration(null)
    expect(await showSystemNotification(message)).toBe('shown')
    expect(constructed).toEqual([{ title: 'Weather in London', options: expect.objectContaining({ body: 'Partly cloudy, 7°C.' }) }])
  })

  it('falls back to the constructor when there is no service worker support at all', async () => {
    const { constructed } = stubNotification('granted')
    expect(await showSystemNotification(message)).toBe('shown')
    expect(constructed).toHaveLength(1)
  })

  it('falls back to the constructor if the worker refuses to show it', async () => {
    const { constructed } = stubNotification('granted')
    stubWorkerRegistration(vi.fn(async () => { throw new Error('boom') }))
    expect(await showSystemNotification(message)).toBe('shown')
    expect(constructed).toHaveLength(1)
  })

  it('reports "failed" (never throws) when neither path works, e.g. the constructor on Android', async () => {
    const FailingNotification = Object.assign(
      function () {
        throw new TypeError('Illegal constructor')
      },
      { permission: 'granted' },
    )
    vi.stubGlobal('Notification', FailingNotification)
    expect(await showSystemNotification(message)).toBe('failed')
  })
})

describe('hasServiceWorkerRegistration', () => {
  it('is false without service worker support', async () => {
    expect(await hasServiceWorkerRegistration()).toBe(false)
  })

  it('reflects whether a registration exists, and never throws', async () => {
    stubWorkerRegistration(vi.fn())
    expect(await hasServiceWorkerRegistration()).toBe(true)
    stubWorkerRegistration(null)
    expect(await hasServiceWorkerRegistration()).toBe(false)
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn(async () => { throw new Error('x') }) },
    })
    expect(await hasServiceWorkerRegistration()).toBe(false)
  })
})
