import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Loader2, RefreshCw, Search, SearchX, TriangleAlert } from 'lucide-react'

import { SearchSuggestions } from '@/components/search/SearchSuggestions'
import { Button } from '@/components/ui/button'
import { useCitySearch } from '@/hooks/useCitySearch'
import type { City } from '@/types/city'
import { cn } from '@/utils/cn'
import { formatCityLabel } from '@/utils/city'
import { MIN_SEARCH_LENGTH } from '@/utils/constants'
import { searchOptionId } from '@/utils/ids'
import { normalizeSearchQuery } from '@/utils/validation'

const PANEL_CLASSES =
  'absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-raised'

type PanelKind = 'none' | 'guidance' | 'loading' | 'error' | 'empty' | 'list'

interface CitySearchProps {
  /** Called with a verified city chosen from the suggestions (never with free text). */
  onSelectCity: (city: City) => void
  className?: string
}

/**
 * Accessible city autocomplete (ARIA 1.2 combobox with a listbox popup).
 * Only suggestions returned by the search service can be chosen, so unverified text is never submitted.
 */
export function CitySearch({ onSelectCity, className }: CitySearchProps) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const listboxId = `${baseId}-listbox`
  const messageId = `${baseId}-message`
  const containerRef = useRef<HTMLDivElement>(null)

  // `value` is what the input shows; `query` is what we search for. They differ after a selection,
  // when the input shows the chosen city's label but no new search should run.
  const [value, setValue] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  // null = "default" (first option once fresh results are shown); a number = the user's explicit choice.
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const { state, query: searchText, retry } = useCitySearch(query)

  const results = state.status === 'success' ? state.results : []
  const hasOptions = results.length > 0
  // Results are "fresh" when they belong to exactly what is currently typed.
  const isFresh = state.status === 'success' && state.query === searchText

  let panel: PanelKind = 'none'
  if (open && searchText.length > 0) {
    if (searchText.length < MIN_SEARCH_LENGTH) panel = 'guidance'
    else if (state.status === 'loading') panel = 'loading'
    else if (state.status === 'error') panel = 'error'
    else if (state.status === 'success') panel = hasOptions ? 'list' : 'empty'
  }

  let effectiveActive = -1
  if (hasOptions) {
    if (activeIndex !== null) effectiveActive = activeIndex < results.length ? activeIndex : -1
    else if (isFresh) effectiveActive = 0
  }

  const valueLength = normalizeSearchQuery(value).length
  const validationMessage =
    touched && !focused && valueLength < MIN_SEARCH_LENGTH
      ? valueLength === 0
        ? 'Enter a city name to search.'
        : `Enter at least ${MIN_SEARCH_LENGTH} characters to search.`
      : null

  let announcement = ''
  if (panel === 'guidance') announcement = `Type at least ${MIN_SEARCH_LENGTH} characters to search for a city.`
  else if (panel === 'loading') announcement = 'Searching for cities…'
  else if (panel === 'empty') announcement = 'No cities found.'
  else if (panel === 'error' && state.status === 'error') announcement = state.error.message
  else if (panel === 'list')
    announcement = `${results.length} ${results.length === 1 ? 'city' : 'cities'} found. Use the up and down arrow keys to review, Enter to select.`

  // Clicking/tapping outside closes the panel.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Keep the active option visible when navigating a long list.
  useEffect(() => {
    if (panel !== 'list' || effectiveActive < 0) return
    document.getElementById(searchOptionId(listboxId, effectiveActive))?.scrollIntoView?.({
      block: 'nearest',
    })
  }, [panel, effectiveActive, listboxId])

  const select = (city: City) => {
    setValue(formatCityLabel(city))
    setQuery('')
    setOpen(false)
    setActiveIndex(null)
    onSelectCity(city)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        if (!hasOptions) return
        const step = event.key === 'ArrowDown' ? 1 : -1
        const from = effectiveActive < 0 ? (step === 1 ? -1 : 0) : effectiveActive
        setActiveIndex((from + step + results.length) % results.length)
        return
      }
      case 'Enter': {
        const city = panel === 'list' && effectiveActive >= 0 ? results[effectiveActive] : undefined
        if (city) {
          event.preventDefault()
          select(city)
        }
        // Otherwise do nothing: free text is never submitted.
        return
      }
      case 'Escape':
        if (open) {
          event.preventDefault()
          setOpen(false)
        }
        return
      case 'Tab':
        setOpen(false)
        return
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false)
          setOpen(false)
          setTouched(true)
        }
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search for a city
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={panel === 'list'}
        aria-controls={panel === 'list' ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          panel === 'list' && effectiveActive >= 0 ? searchOptionId(listboxId, effectiveActive) : undefined
        }
        aria-invalid={validationMessage ? true : undefined}
        aria-describedby={validationMessage ? messageId : undefined}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        maxLength={100}
        placeholder="Search for a city…"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setQuery(event.target.value)
          setOpen(true)
          setActiveIndex(null)
        }}
        onFocus={(event) => {
          setFocused(true)
          event.currentTarget.select()
          if (searchText.length > 0) setOpen(true)
        }}
        onKeyDown={handleKeyDown}
        // 16px on small screens stops iOS Safari zooming the page when the field is focused.
        className={cn(
          'h-11 w-full rounded-lg border bg-card pr-10 pl-10 text-base shadow-xs placeholder:text-muted-foreground md:h-10 md:text-sm',
          validationMessage ? 'border-destructive' : 'border-input',
        )}
      />
      {panel === 'loading' && (
        <Loader2
          className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {validationMessage && (
        <p
          id={messageId}
          className={cn(PANEL_CLASSES, 'flex items-center gap-2 px-3 py-2 text-sm text-destructive')}
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {validationMessage}
        </p>
      )}

      {panel !== 'none' && (
        // Keep focus in the input when interacting with the panel.
        <div className={PANEL_CLASSES} onMouseDown={(event) => event.preventDefault()}>
          {panel === 'guidance' && (
            <p className="flex min-h-11 items-center px-4 py-3 text-sm text-muted-foreground">
              Type at least {MIN_SEARCH_LENGTH} characters to search for a city.
            </p>
          )}
          {panel === 'loading' && (
            <p className="flex min-h-11 items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Searching…
            </p>
          )}
          {panel === 'empty' && (
            <p className="flex min-h-11 items-start gap-2 px-4 py-3 text-sm text-muted-foreground">
              <SearchX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              No cities found. Try another spelling or search by country.
            </p>
          )}
          {panel === 'error' && state.status === 'error' && (
            <div className="flex flex-col items-start gap-2 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {state.error.message}
              </p>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw aria-hidden="true" />
                Try again
              </Button>
            </div>
          )}
          {panel === 'list' && (
            <SearchSuggestions
              listboxId={listboxId}
              cities={results}
              activeIndex={effectiveActive}
              onSelect={select}
              onHover={setActiveIndex}
            />
          )}
        </div>
      )}
    </div>
  )
}
