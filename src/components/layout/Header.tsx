import { CitySearch } from '@/components/search/CitySearch'
import { SettingsButton } from '@/components/settings/SettingsButton'
import { ThemeToggle } from '@/components/settings/ThemeToggle'
import { UnitToggle } from '@/components/settings/UnitToggle'
import { Logo } from '@/components/layout/Logo'
import type { City } from '@/types/city'
import type { TemperatureUnit } from '@/types/weather'

interface HeaderProps {
  onSelectCity: (city: City) => void
  unit: TemperatureUnit
  onUnitChange: (unit: TemperatureUnit) => void
  onOpenSettings: () => void
}

/**
 * DOM order (logo → search → unit → theme → settings) matches the visual order from tablet up, so keyboard focus
 * follows what people see. On mobile the theme toggle sits beside the logo and search drops to its own row.
 */
export function Header({ onSelectCity, unit, onUnitChange, onOpenSettings }: HeaderProps) {
  return (
    <header className="short:static sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:h-16 md:flex-nowrap md:gap-x-6 md:px-6 md:py-0">
        <Logo className="order-1 md:order-none md:w-[calc(15rem-0.5rem)] xl:w-[calc(18rem-0.5rem)]" />
        <CitySearch
          onSelectCity={onSelectCity}
          className="order-3 w-full basis-full md:order-none md:max-w-xl md:flex-1 md:basis-auto"
        />
        <div className="order-2 ml-auto flex items-center gap-2 md:order-none">
          <UnitToggle unit={unit} onChange={onUnitChange} />
          <ThemeToggle />
          <SettingsButton onClick={onOpenSettings} />
        </div>
      </div>
    </header>
  )
}
