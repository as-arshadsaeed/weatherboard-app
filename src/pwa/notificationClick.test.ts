import { beforeEach, describe, expect, it, vi } from 'vitest'

import viteConfigSource from '../../vite.config.ts?raw'
import workerScript from '../../public/sw-notifications.js?raw'

/** Runs public/sw-notifications.js against a fake service-worker scope. */
function loadWorkerScript() {
  const handlers: Record<string, (event: unknown) => void> = {}
  const scope = {
    addEventListener: (type: string, handler: (event: unknown) => void) => (handlers[type] = handler),
    clients: { matchAll: vi.fn(), openWindow: vi.fn(async () => {}) },
  }
  new Function('self', workerScript)(scope)
  return { handlers, scope }
}

async function click(handler: (e: unknown) => void, data?: unknown) {
  let pending: Promise<void> = Promise.resolve()
  const notification = { close: vi.fn(), data }
  handler({ notification, waitUntil: (p: Promise<void>) => (pending = p) })
  await pending
  return notification
}

let script: ReturnType<typeof loadWorkerScript>
beforeEach(() => {
  script = loadWorkerScript()
})

describe('sw-notifications.js', () => {
  it('registers a notificationclick handler', () => {
    expect(script.handlers.notificationclick).toBeTypeOf('function')
  })

  it('closes the notification and focuses an app window that is already open', async () => {
    const focus = vi.fn(async () => {})
    script.scope.clients.matchAll.mockResolvedValue([{ focus }])
    const notification = await click(script.handlers.notificationclick!, { url: '/' })

    expect(notification.close).toHaveBeenCalled()
    expect(script.scope.clients.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true })
    expect(focus).toHaveBeenCalledOnce()
    expect(script.scope.clients.openWindow).not.toHaveBeenCalled()
  })

  it('opens the app when no window is open', async () => {
    script.scope.clients.matchAll.mockResolvedValue([])
    await click(script.handlers.notificationclick!, { url: '/' })
    expect(script.scope.clients.openWindow).toHaveBeenCalledWith('/')
  })

  it('defaults to the app root when the notification carries no URL', async () => {
    script.scope.clients.matchAll.mockResolvedValue([])
    await click(script.handlers.notificationclick!, undefined)
    expect(script.scope.clients.openWindow).toHaveBeenCalledWith('/')
  })

  it('is wired into the generated worker via importScripts', () => {
    expect(viteConfigSource).toContain("importScripts: ['sw-notifications.js']")
  })
})
