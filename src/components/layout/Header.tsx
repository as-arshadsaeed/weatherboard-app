import { CitySearch } from '@/components/search/CitySearch'
import { ThemeToggle } from '@/components/settings/ThemeToggle'
import { Logo } from '@/components/layout/Logo'
import type { City } from '@/types/city'

/**
 * DOM order (logo → search → theme) matches the visual order from tablet up, so keyboard focus
 * follows what people see. On mobile the theme toggle sits beside the logo and search drops to its own row.
 */
export function Header({ onSelectCity }: { onSelectCity: (city: City) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:h-16 md:flex-nowrap md:gap-x-6 md:px-6 md:py-0">
        <Logo className="order-1 md:order-none md:w-[calc(15rem-0.5rem)] xl:w-[calc(18rem-0.5rem)]" />
        <CitySearch
          onSelectCity={onSelectCity}
          className="order-3 w-full basis-full md:order-none md:max-w-xl md:flex-1 md:basis-auto"
        />
        <div className="order-2 ml-auto flex items-center gap-2 md:order-none">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
