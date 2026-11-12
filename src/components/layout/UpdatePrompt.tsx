import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  applyServiceWorkerUpdate,
  dismissUpdatePrompt,
  useServiceWorkerStatus,
} from '@/pwa/serviceWorker'

/** Non-blocking prompt shown when a new version is ready. Nothing reloads until the user chooses to. */
export function UpdatePrompt() {
  const { needRefresh } = useServiceWorkerStatus()
  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-card"
    >
      <RefreshCw className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">A new version of WeatherBoard is ready.</span>{' '}
        <span className="text-muted-foreground">
          Your saved cities and settings are kept when you reload.
        </span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void applyServiceWorkerUpdate()}>
          Reload
        </Button>
        <Button size="sm" variant="ghost" onClick={dismissUpdatePrompt}>
          Later
        </Button>
      </div>
    </div>
  )
}
