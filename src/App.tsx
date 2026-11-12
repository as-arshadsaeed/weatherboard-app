import { useEffect, useState } from 'react'

import { FavouriteButton } from '@/components/favourites/FavouriteButton'
import { FavouriteCities } from '@/components/favourites/FavouriteCities'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { StorageNotice } from '@/components/layout/StorageNotice'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { NoCitySelected } from '@/components/weather/NoCitySelected'
import { WeatherDashboard } from '@/components/weather/WeatherDashboard'
import { useFavourites } from '@/hooks/useFavourites'
import { useSelectedCity } from '@/hooks/useSelectedCity'
import { useUnits } from '@/hooks/useUnits'
import { probeStorage } from '@/services/storageService'
import type { City } from '@/types/city'
import { formatLocation } from '@/utils/city'

export default function App() {
  const { unit, setUnit } = useUnits()
  const { city, selectCity } = useSelectedCity()
  const favourites = useFavourites()
  // The favourite awaiting removal confirmation. `city` outlives `open` so the dialog text does not
  // blank out while it closes.
  const [removal, setRemoval] = useState<{ city: City; open: boolean } | null>(null)
  const requestRemoval = (city: City) => setRemoval({ city, open: true })
  const cancelRemoval = () => setRemoval((current) => current && { ...current, open: false })

  // Find out up front whether we can save anything, so the notice does not wait for a failed save.
  useEffect(() => probeStorage(), [])

  const confirmRemoval = () => {
    if (!removal) return
    favourites.remove(removal.city)
    cancelRemoval()
    // If the "remove" button that opened the dialog is gone, focus is lost (on <body>, or still in the
    // closed dialog). Land on the panel heading rather than at the top of the page.
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (!active || active === document.body || active.closest('dialog:not([open])')) {
        document.getElementById('favourites-heading')?.focus()
      }
    })
  }

  const removing = removal?.city ?? null
  const removingPlace = removing ? formatLocation(removing) : ''

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Header onSelectCity={selectCity} unit={unit} onUnitChange={setUnit} />
      <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-6 md:grid-cols-[15rem_minmax(0,1fr)] md:px-6 md:py-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6 md:col-span-2 empty:hidden">
          <StorageNotice />
        </div>
        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          {city ? (
            <WeatherDashboard
              city={city}
              unit={unit}
              action={
                <FavouriteButton
                  key={city.id}
                  city={city}
                  isFavourite={favourites.isFavourite(city)}
                  onAdd={() => favourites.add(city)}
                  onRequestRemove={() => requestRemoval(city)}
                />
              }
            />
          ) : (
            <NoCitySelected />
          )}
        </main>
        <Sidebar>
          <FavouriteCities
            favourites={favourites.favourites}
            selectedCity={city}
            onSelect={selectCity}
            onRequestRemove={requestRemoval}
          />
        </Sidebar>
      </div>
      <ConfirmDialog
        open={removal?.open ?? false}
        title={removing ? `Remove ${removing.name} from favourites?` : 'Remove favourite?'}
        description={
          removing
            ? `${removing.name}${removingPlace ? ` (${removingPlace})` : ''} will be removed from your quick-access list. You can save it again at any time.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={confirmRemoval}
        onCancel={cancelRemoval}
      />
    </>
  )
}
