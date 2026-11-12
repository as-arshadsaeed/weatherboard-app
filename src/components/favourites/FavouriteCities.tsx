import { Star, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { City } from '@/types/city'
import { cn } from '@/utils/cn'
import { isSameCity, formatLocation } from '@/utils/city'
import { MAX_FAVOURITES } from '@/utils/constants'

interface FavouriteCitiesProps {
  favourites: readonly City[]
  /** The city currently shown, highlighted when it is a favourite. */
  selectedCity: City | null
  onSelect: (city: City) => void
  /** Removal is confirmed by the parent before anything is deleted. */
  onRequestRemove: (city: City) => void
}

/** Quick-access panel: switch to a saved city or remove it (after confirmation). */
export function FavouriteCities({
  favourites,
  selectedCity,
  onSelect,
  onRequestRemove,
}: FavouriteCitiesProps) {
  const count = favourites.length

  return (
    <section
      aria-labelledby="favourites-heading"
      className="rounded-2xl border bg-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        {/* Focusable (not tabbable) so focus has somewhere sensible to land after a removal. */}
        <h2
          id="favourites-heading"
          tabIndex={-1}
          className="rounded-sm text-sm font-semibold tracking-tight outline-offset-4"
        >
          Favourites
        </h2>
        <span className="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <span className="sr-only">{`${count} of ${MAX_FAVOURITES} favourites saved`}</span>
          <span aria-hidden="true">
            {count} / {MAX_FAVOURITES}
          </span>
        </span>
      </div>

      {count === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center">
          <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Star className="size-[1.125rem]" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium">No favourites yet</p>
          <p className="mt-1 text-sm text-balance text-muted-foreground">
            Save up to {MAX_FAVOURITES} cities for quick access.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-1">
          {favourites.map((city) => {
            const selected = selectedCity !== null && isSameCity(city, selectedCity)
            const location = formatLocation(city)
            return (
              <li key={city.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(city)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-accent md:min-h-10',
                    // The inset bar marks the selected city without relying on colour alone.
                    selected && 'bg-accent shadow-[inset_3px_0_0_var(--brand)]',
                  )}
                >
                  <span className="block [overflow-wrap:anywhere] text-sm font-medium">{city.name}</span>
                  {location && (
                    <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground">{location}</span>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => onRequestRemove(city)}
                  aria-label={`Remove ${city.name} from favourites`}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
