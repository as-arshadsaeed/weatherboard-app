import { useEffect, useState, type ComponentProps, type ComponentType } from 'react'
import type { Analytics as AnalyticsComponent } from '@vercel/analytics/react'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAnalyticsEnabled, redactAnalyticsEvent } from '@/utils/analytics'

const ENABLED = isAnalyticsEnabled(import.meta.env.VITE_ANALYTICS, __VERCEL_ENV__)

/**
 * Vercel Web Analytics, mounted once at the app root (main.tsx).
 *
 * It is invisible, optional and never allowed to affect the app:
 * - off unless the build opts in (see isAnalyticsEnabled), and then loaded as a separate chunk;
 * - not started while offline, so there is no failing request to log;
 * - every failure (chunk missing, script blocked by an ad blocker or privacy mode) is swallowed;
 * - page views are redacted to the path alone before they are sent.
 */
export function AppAnalytics({ enabled = ENABLED }: { enabled?: boolean }) {
  const online = useOnlineStatus()
  const [Analytics, setAnalytics] = useState<ComponentType<AnalyticsProps> | null>(null)

  // Loads only while enabled and online. Once loaded it stays mounted (the state is kept) even if the
  // connection later drops; going offline before it has loaded just cancels the pending load.
  useEffect(() => {
    if (!enabled || !online) return
    let cancelled = false
    import('@vercel/analytics/react')
      .then((module) => {
        if (!cancelled) setAnalytics(() => module.Analytics)
      })
      .catch(() => {
        // Analytics is optional; the app works the same without it.
      })
    return () => {
      cancelled = true
    }
  }, [enabled, online])

  return Analytics ? <Analytics beforeSend={redactAnalyticsEvent} /> : null
}

type AnalyticsProps = ComponentProps<typeof AnalyticsComponent>
