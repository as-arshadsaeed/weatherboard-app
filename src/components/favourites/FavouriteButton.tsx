import { useId, useState } from 'react'
import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AddFavouriteResult } from '@/hooks/useFavourites'
import type { City } from '@/types/city'
import { MAX_FAVOURITES } from '@/utils/constants'

interface FavouriteButtonProps {
  city: City
  isFavourite: boolean
  onAdd: () => AddFavouriteResult
  /** Removal always goes through a confirmation, owned by the parent. */
  onRequestRemove: () => void
}

/**
 * Save the shown city to favourites. Saving is one click; removing opens a confirmation. The saved
 * state is shown by a filled star *and* the word "Saved" (never colour alone). When the favourites
 * are full, a visible message explains what to do. Render with `key={city.id}` so notices reset per city.
 */
export function FavouriteButton({ city, isFavourite, onAdd, onRequestRemove }: FavouriteButtonProps) {
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const hintId = useId()

  const handleClick = () => {
    if (isFavourite) {
      onRequestRemove()
      return
    }
    const result = onAdd()
    if (result === 'full') {
      setNotice(`Favourites are full (${MAX_FAVOURITES} of ${MAX_FAVOURITES}). Remove one to save another.`)
      setAnnouncement('')
    } else if (result === 'added') {
      setNotice(null)
      setAnnouncement(`${city.name} added to favourites.`)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        variant="outline"
        size="sm"
        // Wraps (instead of overflowing) when text is enlarged or the column is very narrow.
        className="h-auto min-h-11 max-w-full py-2 whitespace-normal md:min-h-9"
        onClick={handleClick}
        aria-describedby={isFavourite ? hintId : undefined}
      >
        <Star className={isFavourite ? 'fill-current text-brand' : undefined} aria-hidden="true" />
        {isFavourite ? 'Saved' : 'Add to favourites'}
      </Button>
      {isFavourite && (
        <span id={hintId} className="sr-only">
          Press to remove {city.name} from favourites.
        </span>
      )}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
