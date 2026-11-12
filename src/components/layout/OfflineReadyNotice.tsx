import { CircleCheck, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { dismissOfflineReady, useServiceWorkerStatus } from '@/pwa/serviceWorker'

/**
 * Shown once, when the app shell has been cached. It is careful about what it promises: the app opens
 * offline, but weather is only available for cities that have been viewed.
 */
export function OfflineReadyNotice() {
  const { offlineReady } = useServiceWorkerStatus()
  if (!offlineReady) return null

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-card"
    >
      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">WeatherBoard can now open without a connection.</span>{' '}
        <span className="text-muted-foreground">
          Weather is available offline only for cities you have already viewed.
        </span>
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="-my-2 -mr-2 shrink-0"
        onClick={dismissOfflineReady}
        aria-label="Dismiss offline-ready notice"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
