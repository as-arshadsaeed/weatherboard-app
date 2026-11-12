import type { ReminderMessage } from '@/utils/reminder'

/**
 * Notification permission and delivery, kept separate from the UI and from scheduling so a server-side
 * Web Push provider can be added later without rewriting either.
 *
 * What this client-only version can and cannot do:
 * - It shows notifications only while WeatherBoard is open (a tab, or the installed app window).
 *   Nothing here can wake a closed browser; reliable delivery then needs a server (see REMINDER_DELIVERY).
 * - It never requests permission by itself: requestNotificationPermission() is only called after the
 *   user explicitly asks for it in the settings.
 */

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

/**
 * How reminders reach the user. The settings UI words its promises from this, so it can never claim more
 * than the delivery mechanism can do.
 *
 * To add real background push later: implement a provider that creates a push subscription (VAPID key),
 * stores it server-side and has a scheduled job send the reminders; then set `kind: 'web-push'` and
 * `backgroundDelivery: true`. The UI, preferences and message builder stay as they are.
 */
export interface ReminderDelivery {
  readonly kind: 'in-app' | 'web-push'
  /** True only if reminders can arrive while the app and browser are closed. */
  readonly backgroundDelivery: boolean
}

export const REMINDER_DELIVERY: ReminderDelivery = { kind: 'in-app', backgroundDelivery: false }

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function toState(value: unknown): NotificationPermissionState {
  return value === 'granted' || value === 'denied' ? value : 'default'
}

export function getNotificationPermission(): NotificationPermissionState {
  return isNotificationSupported() ? toState(Notification.permission) : 'unsupported'
}

/**
 * Ask the browser for permission. Call only from an explicit user action. Never throws: a dismissed
 * prompt resolves to 'default'; an unsupported browser to 'unsupported'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    // Very old browsers return nothing from the promise form; the property is then the source of truth.
    return result === undefined ? getNotificationPermission() : toState(result)
  } catch {
    return getNotificationPermission()
  }
}

/** Whether a worker registration exists (system notifications are shown through it where possible). */
export async function hasServiceWorkerRegistration(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    return (await navigator.serviceWorker.getRegistration()) !== undefined
  } catch {
    return false
  }
}

/** Is the user looking at WeatherBoard right now? Then the in-app banner is enough. */
export function isPageActive(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}

/** A system notification adds nothing while the page is in front of the user, and needs permission. */
export function shouldShowSystemNotification(input: {
  permission: NotificationPermissionState
  pageActive: boolean
}): boolean {
  return input.permission === 'granted' && !input.pageActive
}

export type ShowOutcome = 'shown' | 'no-permission' | 'unsupported' | 'failed'

/**
 * Show a system notification. Prefers the service worker (required on Android Chrome, where the
 * Notification constructor throws), and falls back to the constructor where there is no worker.
 */
export async function showSystemNotification(message: ReminderMessage): Promise<ShowOutcome> {
  if (!isNotificationSupported()) return 'unsupported'
  if (getNotificationPermission() !== 'granted') return 'no-permission'

  const options: NotificationOptions = {
    body: message.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // One reminder per day: a newer one replaces an unread older one instead of stacking.
    tag: 'weatherboard-daily-reminder',
    data: { url: '/' },
  }

  try {
    const registration =
      'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (registration) {
      await registration.showNotification(message.title, options)
      return 'shown'
    }
  } catch {
    // fall through to the constructor
  }
  try {
    new Notification(message.title, options)
    return 'shown'
  } catch {
    return 'failed'
  }
}
