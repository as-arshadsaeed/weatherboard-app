import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { FavouriteCities } from '@/components/favourites/FavouriteCities'
import { NoCitySelected } from '@/components/weather/NoCitySelected'

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Header />
      <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-6 md:grid-cols-[15rem_minmax(0,1fr)] md:px-6 md:py-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          <NoCitySelected />
        </main>
        <Sidebar>
          <FavouriteCities />
        </Sidebar>
      </div>
    </>
  )
}
