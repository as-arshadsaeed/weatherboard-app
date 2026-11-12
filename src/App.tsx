import { useEffect, useRef, useState } from 'react'

import { FavouriteButton } from '@/components/favourites/FavouriteButton'
import { FavouriteCities } from '@/components/favourites/FavouriteCities'
import { Header } from '@/components/layout/Header'
import { MobileNavigation, type MobileView } from '@/components/layout/MobileNavigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { OfflineReadyNotice } from '@/components/layout/OfflineReadyNotice'
import { ReminderBanner } from '@/components/layout/ReminderBanner'
import { StorageNotice } from '@/components/layout/StorageNotice'
import { UpdatePrompt } from '@/components/layout/UpdatePrompt'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { NoCitySelected } from '@/components/weather/NoCitySelected'
import { WeatherDashboard } from '@/components/weather/WeatherDashboard'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useFavourites } from '@/hooks/useFavourites'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useReminderPreference } from '@/hooks/useReminderPreference'
import { useReminders } from '@/hooks/useReminders'
import { useSelectedCity } from '@/hooks/useSelectedCity'
import { useUnits } from '@/hooks/useUnits'
import { probeStorage } from '@/services/storageService'
import type { City } from '@/types/city'
import { cn } from '@/utils/cn'
import { formatLocation } from '@/utils/city'

export default function App() {
  const { unit, setUnit } = useUnits()
  const { city, selectCity } = useSelectedCity()
  const favourites = useFavourites()
  const reminderPreference = useReminderPreference()
  const { reminder, dismissReminder, sendTestReminder } = useReminders({
    preference: reminderPreference.preference,
    claimReminder: reminderPreference.claimReminder,
    city,
    unit,
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  useDocumentTitle(city?.name ?? null)
  const isPhone = !useMediaQuery('(min-width: 48rem)')
  // The favourite awaiting removal confirmation. `city` outlives `open` so the dialog text does not
  // blank out while it closes.
  const [removal, setRemoval] = useState<{ city: City; open: boolean } | null>(null)
  const requestRemoval = (city: City) => setRemoval({ city, open: true })
  const cancelRemoval = () => setRemoval((current) => current && { ...current, open: false })

  // Phones show one view at a time (Weather or Favourites); tablet and up show both side by side.
  const [view, setView] = useState<MobileView>('weather')
  const mainRef = useRef<HTMLElement>(null)

  /** Choose a city from anywhere (search or favourites) and go to its weather. */
  const showCity = (next: City) => {
    selectCity(next)
    setView('weather')
    // If the control that was just used is no longer visible (the Favourites view hid), move focus to
    // the weather instead of leaving it on a hidden element.
    requestAnimationFrame(() => {
      const active = document.activeElement
      const lost = !active || active === document.body || active.checkVisibility?.() === false
      if (lost) mainRef.current?.focus({ preventScroll: true })
    })
  }

  const changeView = (next: MobileView) => {
    setView(next)
    document.documentElement.scrollTop = 0
  }

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
        // On a phone's Favourites view <main> is hidden, so make it the visible target first.
        onClick={() => setView('weather')}
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Header
        onSelectCity={showCity}
        unit={unit}
        onUnitChange={setUnit}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="mx-auto grid max-w-[88rem] gap-6 px-4 pt-6 pb-24 md:grid-cols-[15rem_minmax(0,1fr)] md:px-6 md:py-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6 md:order-first md:col-span-2 empty:hidden">
          {reminder && <ReminderBanner reminder={reminder} onDismiss={dismissReminder} />}
          <OfflineBanner />
          <UpdatePrompt />
          <OfflineReadyNotice />
          <StorageNotice />
        </div>
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className={cn('min-w-0 outline-none', view !== 'weather' && 'hidden md:block')}
        >
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
        <Sidebar asMain={isPhone && view === 'favourites'} className={cn(view !== 'favourites' && 'hidden md:block')}>
          <FavouriteCities
            favourites={favourites.favourites}
            selectedCity={city}
            onSelect={showCity}
            onRequestRemove={requestRemoval}
          />
        </Sidebar>
      </div>
      <MobileNavigation
        view={view}
        onChange={changeView}
        favouriteCount={favourites.favourites.length}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <NotificationSettings
          preference={reminderPreference.preference}
          onEnabledChange={reminderPreference.setEnabled}
          onTimeChange={reminderPreference.setTime}
          onSendTest={sendTestReminder}
          testReminder={reminder}
          city={city}
          unit={unit}
        />
      </SettingsDialog>
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
