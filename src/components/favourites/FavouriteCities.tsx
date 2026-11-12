import { Star } from 'lucide-react'

import { MAX_FAVOURITES } from '@/utils/constants'

/**
 * Favourites quick-access panel. Adding/removing cities needs a selectable city
 * (Phases 3–4), so for now this renders its genuine empty state.
 */
export function FavouriteCities() {
  const count = 0

  return (
    <section
      aria-labelledby="favourites-heading"
      className="rounded-2xl border bg-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <h2 id="favourites-heading" className="text-sm font-semibold tracking-tight">
          Favourites
        </h2>
        <span
          className="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
          aria-label={`${count} of ${MAX_FAVOURITES} favourites saved`}
        >
          {count} / {MAX_FAVOURITES}
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center">
        <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <Star className="size-[1.125rem]" aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm font-medium">No favourites yet</p>
        <p className="mt-1 text-sm text-balance text-muted-foreground">
          Save up to {MAX_FAVOURITES} cities for quick access.
        </p>
      </div>
    </section>
  )
}
