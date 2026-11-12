import { RefreshCw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { City } from '@/types/city'
import type { WeatherApiError } from '@/services/weatherApi'
import { formatLocation } from '@/utils/city'

interface WeatherErrorProps {
  city: City
  error: WeatherApiError
  onRetry: () => void
}

/** Error state: icon + text (never colour alone), the specific reason, and a retry when it can help. */
export function WeatherError({ city, error, onRetry }: WeatherErrorProps) {
  const place = formatLocation(city)

  return (
    <section className="flex min-h-[26rem] flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
      <div className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
        Weather unavailable for {city.name}
      </h1>
      {place && <p className="mt-1 text-sm text-muted-foreground">{place}</p>}
      <p role="alert" className="mt-3 max-w-md text-base text-balance text-muted-foreground">
        {error.message}
      </p>
      {error.isRetryable && (
        <Button className="mt-6" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </section>
  )
}
