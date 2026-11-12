import { useEffect, useState } from 'react'
import { CircleCheck, WifiOff } from 'lucide-react'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const RECONNECTED_VISIBLE_MS = 5000

/**
 * Tells the user when they are offline (and what that means), and briefly confirms when the
 * connection returns. Icon plus text, so the state never depends on colour alone.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    let timer: number | undefined
    const onOnline = () => {
      setJustReconnected(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setJustReconnected(false), RECONNECTED_VISIBLE_MS)
    }
    const onOffline = () => {
      window.clearTimeout(timer)
      setJustReconnected(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearTimeout(timer)
    }
  }, [])

  if (!online) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-warning/40 bg-card px-4 py-3 text-sm shadow-card"
      >
        <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <span className="font-medium">You’re offline.</span>{' '}
          <span className="text-muted-foreground">
            Weather you’ve viewed before is still available; other cities need a connection.
          </span>
        </p>
      </div>
    )
  }

  if (justReconnected) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-card"
      >
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <span className="font-medium">You’re back online.</span>{' '}
          <span className="text-muted-foreground">Updating the weather…</span>
        </p>
      </div>
    )
  }

  return null
}
