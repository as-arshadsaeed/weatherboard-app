import { MapPin } from 'lucide-react'

import type { City } from '@/types/city'
import { cn } from '@/utils/cn'
import { formatLocation } from '@/utils/city'
import { searchOptionId } from '@/utils/ids'

interface SearchSuggestionsProps {
  listboxId: string
  cities: readonly City[]
  activeIndex: number
  onSelect: (city: City) => void
  onHover: (index: number) => void
}

/** The listbox of city options. Focus stays in the input; the active option is exposed via aria-activedescendant. */
export function SearchSuggestions({
  listboxId,
  cities,
  activeIndex,
  onSelect,
  onHover,
}: SearchSuggestionsProps) {
  return (
    <ul
      id={listboxId}
      role="listbox"
      aria-label="City suggestions"
      className="max-h-[min(24rem,60dvh)] overflow-y-auto overscroll-contain py-1.5"
    >
      {cities.map((city, index) => {
        const active = index === activeIndex
        const location = formatLocation(city)
        return (
          <li
            key={city.id}
            id={searchOptionId(listboxId, index)}
            role="option"
            aria-selected={active}
            data-active={active}
            onClick={() => onSelect(city)}
            onMouseMove={() => !active && onHover(index)}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2',
              // The inset bar marks the active option without relying on colour alone.
              active && 'bg-accent shadow-[inset_3px_0_0_var(--brand)]',
            )}
          >
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{city.name}</span>
              {location && (
                <span className="block truncate text-sm text-muted-foreground">{location}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
