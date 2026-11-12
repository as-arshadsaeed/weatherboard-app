import { vi } from 'vitest'

/**
 * TEST-ONLY stand-in for the build-time `virtual:pwa-register` module. It records the options the app
 * passes so tests can simulate "update available" / "offline ready" and check what the app asks for.
 */
export interface RegisterSWOptions {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
  onRegisterError?: (error: unknown) => void
}

export const registerSWCalls: RegisterSWOptions[] = []
export const updateServiceWorker = vi.fn<(reloadPage?: boolean) => Promise<void>>(async () => {})

export function registerSW(options: RegisterSWOptions = {}) {
  registerSWCalls.push(options)
  return updateServiceWorker
}
