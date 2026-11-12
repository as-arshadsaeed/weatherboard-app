import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useNotificationPermission } from '@/hooks/useNotificationPermission'

type Permission = 'default' | 'granted' | 'denied'

function stubNotification(initial: Permission, answer: Permission = initial) {
  class FakeNotification {
    static permission: Permission = initial
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = answer
      return answer
    })
  }
  vi.stubGlobal('Notification', FakeNotification)
  return FakeNotification
}

function stubPermissionsApi() {
  const listeners = new Set<() => void>()
  const status = {
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn(async () => status) },
  })
  return { fire: () => listeners.forEach((l) => l()), listeners }
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (navigator as unknown as Record<string, unknown>).permissions
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
})

describe('useNotificationPermission', () => {
  it('reports "unsupported" when there is no Notification API', () => {
    const { result } = renderHook(() => useNotificationPermission())
    expect(result.current.permission).toBe('unsupported')
  })

  it.each(['default', 'granted', 'denied'] as const)('reflects the browser state "%s" without prompting', (state) => {
    const Notification = stubNotification(state)
    const { result } = renderHook(() => useNotificationPermission())
    expect(result.current.permission).toBe(state)
    expect(Notification.requestPermission).not.toHaveBeenCalled() // reading never asks
  })

  it('asks only when request() is called, and updates to the answer', async () => {
    const Notification = stubNotification('default', 'granted')
    const { result } = renderHook(() => useNotificationPermission())
    expect(Notification.requestPermission).not.toHaveBeenCalled()

    let answer = ''
    await act(async () => {
      answer = await result.current.request()
    })
    expect(answer).toBe('granted')
    expect(result.current.permission).toBe('granted')
    expect(Notification.requestPermission).toHaveBeenCalledOnce()
  })

  it('shows "denied" after the user refuses', async () => {
    stubNotification('default', 'denied')
    const { result } = renderHook(() => useNotificationPermission())
    await act(async () => void (await result.current.request()))
    expect(result.current.permission).toBe('denied')
  })

  it('stays "default" if the prompt is dismissed', async () => {
    stubNotification('default', 'default')
    const { result } = renderHook(() => useNotificationPermission())
    await act(async () => void (await result.current.request()))
    expect(result.current.permission).toBe('default')
  })

  it('notices when the user changes the permission in browser settings (Permissions API)', async () => {
    const Notification = stubNotification('granted')
    const api = stubPermissionsApi()
    const { result } = renderHook(() => useNotificationPermission())
    await waitFor(() => expect(api.listeners.size).toBe(1))

    Notification.permission = 'denied'
    act(() => api.fire())
    expect(result.current.permission).toBe('denied')
  })

  it('re-reads the permission when the window regains focus (browsers without the Permissions API)', () => {
    const Notification = stubNotification('default')
    const { result } = renderHook(() => useNotificationPermission())
    Notification.permission = 'granted'
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(result.current.permission).toBe('granted')
  })

  it('stops listening when unmounted', async () => {
    stubNotification('granted')
    const api = stubPermissionsApi()
    const { unmount } = renderHook(() => useNotificationPermission())
    await waitFor(() => expect(api.listeners.size).toBe(1))
    unmount()
    expect(api.listeners.size).toBe(0)
  })

  it('reports whether a service worker is available to show notifications', async () => {
    stubNotification('granted')
    const { result: without } = renderHook(() => useNotificationPermission())
    await waitFor(() => expect(without.current.serviceWorkerAvailable).toBe(false))

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn(async () => ({})) },
    })
    const { result: withWorker } = renderHook(() => useNotificationPermission())
    await waitFor(() => expect(withWorker.current.serviceWorkerAvailable).toBe(true))
  })
})
