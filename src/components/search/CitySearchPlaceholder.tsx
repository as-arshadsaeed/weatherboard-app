import { useId } from 'react'
import { Search } from 'lucide-react'

import { cn } from '@/utils/cn'

/**
 * Disabled stand-in for the city search until the autocomplete is built (Phase 3).
 * It is deliberately inert: it does not accept input or pretend to return results.
 */
export function CitySearchPlaceholder({ className }: { className?: string }) {
  const inputId = useId()
  const hintId = useId()

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={inputId} className="sr-only">
        Search for a city
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={inputId}
        type="search"
        disabled
        aria-describedby={hintId}
        placeholder="Search for a city…"
        className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-10 text-sm shadow-xs placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 md:h-10"
      />
      <span id={hintId} className="sr-only">
        City search is not available yet.
      </span>
    </div>
  )
}
