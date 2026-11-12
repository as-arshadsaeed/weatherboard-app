import { CitySearchPlaceholder } from '@/components/search/CitySearchPlaceholder'
import { ThemeToggle } from '@/components/settings/ThemeToggle'
import { Logo } from '@/components/layout/Logo'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:h-16 md:flex-nowrap md:gap-x-6 md:px-6 md:py-0">
        <Logo className="order-1 md:w-[calc(15rem-0.5rem)] xl:w-[calc(18rem-0.5rem)]" />
        <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
          <ThemeToggle />
        </div>
        <CitySearchPlaceholder className="order-3 w-full basis-full md:order-2 md:max-w-xl md:flex-1 md:basis-auto" />
      </div>
    </header>
  )
}
