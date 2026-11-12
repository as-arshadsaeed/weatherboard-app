import { CloudOff, Loader2, RefreshCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/useNow'
import type { CachedReason } from '@/hooks/useWeather'
import { formatSavedAt } from '@/utils/date'

interface CachedWeatherNoticeProps {
  /** When the saved report was retrieved (epoch ms). */
  cachedAt: number
  reason: CachedReason
  /** A fresh forecast is being fetched in the background. */
  refreshing: boolean
  onRetry: () => void
}

/**
 * Says plainly that the weather below is saved, from when, and that it may be out of date. It never
 * presents saved data as live: the age is always shown, in absolute and relative terms.
 */
export function CachedWeatherNotice({ cachedAt, reason, refreshing, onRetry }: CachedWeatherNoticeProps) {
  // Re-render each minute so "5 minutes ago" keeps counting without refetching anything.
  const now = useNow(60_000)
  const { absolute, relative } = formatSavedAt(cachedAt, now.getTime())
  const offline = reason === 'offline'
  const Icon = offline ? WifiOff : CloudOff

  return (
    <section
      role="status"
      aria-label="Saved weather"
      className="flex flex-wrap items-start gap-x-3 gap-y-3 rounded-2xl border border-warning/40 bg-card px-4 py-3 text-sm shadow-card"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {offline
            ? 'You’re offline. Showing saved weather.'
            : 'Can’t reach the weather service. Showing saved weather.'}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Last updated{' '}
          <time dateTime={new Date(cachedAt).toISOString()} className="font-medium text-foreground">
            {absolute}
          </time>{' '}
          ({relative}). Conditions may have changed since then.
        </p>
        {offline && !refreshing && (
          <p className="mt-0.5 text-muted-foreground">It will update automatically when you’re back online.</p>
        )}
        {refreshing && (
          <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Updating…
          </p>
        )}
      </div>
      {!offline && !refreshing && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </section>
  )
}
