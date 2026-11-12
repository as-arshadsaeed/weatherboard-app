import { useCallback, useEffect, useState } from 'react'

import {
  getNotificationPermission,
  hasServiceWorkerRegistration,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '@/services/notificationService'

/**
 * Current notification permission, kept in step with the browser (the user can change it in browser
 * settings while the app is open), plus whether a service worker is available to show notifications.
 *
 * Reading never prompts. `request()` is the only thing that does, and the UI calls it only after the user
 * has read the explanation and explicitly asked.
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermissionState>(getNotificationPermission)
  const [serviceWorkerAvailable, setServiceWorkerAvailable] = useState(true)

  useEffect(() => {
    const refresh = () => setPermission(getNotificationPermission())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    // Where supported, the Permissions API tells us the moment the user changes it elsewhere.
    let status: PermissionStatus | undefined
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions
        .query({ name: 'notifications' })
        .then((result) => {
          status = result
          result.addEventListener('change', refresh)
        })
        .catch(() => {})
    }
    hasServiceWorkerRegistration().then(setServiceWorkerAvailable)

    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      status?.removeEventListener('change', refresh)
    }
  }, [])

  const request = useCallback(async (): Promise<NotificationPermissionState> => {
    const result = await requestNotificationPermission()
    setPermission(result)
    return result
  }, [])

  return { permission, serviceWorkerAvailable, request }
}
