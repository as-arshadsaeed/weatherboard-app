import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker registration and its UI-facing state.
 *
 * The worker is configured for "prompt" updates: a new version installs in the background and then
 * waits. `needRefresh` tells the UI it is ready; the page only reloads when the user accepts, so an
 * update can never interrupt what they are doing. (Saved weather lives in IndexedDB, which a worker
 * update never touches.)
 */

export interface ServiceWorkerStatus {
  /** A new version is installed and waiting for the user to reload. */
  needRefresh: boolean
  /** The app shell has been cached for the first time, so it can now open offline. */
  offlineReady: boolean
}

const INITIAL_STATUS: ServiceWorkerStatus = { needRefresh: false, offlineReady: false }
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

let status: ServiceWorkerStatus = INITIAL_STATUS
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null
let started = false
let currentRegistration: ServiceWorkerRegistration | undefined
/** The waiting worker the user chose "Later" for, so repeat announcements of it do not re-open the prompt. */
let dismissedWorker: ServiceWorker | null = null
const listeners = new Set<() => void>()

function setStatus(patch: Partial<ServiceWorkerStatus>): void {
  status = { ...status, ...patch }
  listeners.forEach((listener) => listener())
}

/** Register the worker once. Safe to call repeatedly and in browsers without service workers. */
export function startServiceWorker(): void {
  if (started || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  started = true

  applyUpdate = registerSW({
    onNeedRefresh: () => {
      // Workbox can announce the same waiting worker more than once (installed, then waiting). A
      // newer version is a different worker object and still prompts.
      const waiting = currentRegistration?.waiting ?? null
      if (waiting !== null && waiting === dismissedWorker) return
      setStatus({ needRefresh: true })
    },
    onOfflineReady: () => setStatus({ offlineReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return
      currentRegistration = registration
      // Long-lived tabs and installed apps rarely navigate, so check for a new version periodically
      // and whenever the connection comes back.
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => {})
      }
      window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
      window.addEventListener('online', check)
    },
    onRegisterError: (error) => {
      // The app works without a worker; it just cannot open offline.
      console.warn('Service worker registration failed:', error)
    },
  })
}

/**
 * Activate the waiting version and reload. Call only after the user agrees.
 *
 * The reload is done here, not left to the plugin: workbox treats any update found after the first
 * as "external" (it assumes another tab triggered it) and the plugin only reloads for updates it
 * considers its own. Updates found by our periodic / reconnect checks would otherwise activate but
 * never reload, so "Reload" would appear to do nothing.
 */
export async function applyServiceWorkerUpdate(
  reload: () => void = () => window.location.reload(),
): Promise<void> {
  if (!applyUpdate) return
  let reloading = false
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      if (reloading) return
      reloading = true
      reload()
    },
    { once: true },
  )
  await applyUpdate(true) // posts SKIP_WAITING to the waiting worker
}

export function dismissUpdatePrompt(): void {
  dismissedWorker = currentRegistration?.waiting ?? null
  setStatus({ needRefresh: false })
}

export function dismissOfflineReady(): void {
  setStatus({ offlineReady: false })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useServiceWorkerStatus(): ServiceWorkerStatus {
  return useSyncExternalStore(subscribe, () => status, () => INITIAL_STATUS)
}

/** Test helper: forget registration state between tests. */
export function resetServiceWorkerStateForTests(): void {
  status = INITIAL_STATUS
  applyUpdate = null
  started = false
  currentRegistration = undefined
  dismissedWorker = null
  listeners.clear()
}
