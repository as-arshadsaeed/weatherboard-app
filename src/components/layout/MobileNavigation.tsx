import { CloudSun, Settings, Star, type LucideIcon } from 'lucide-react'

import { cn } from '@/utils/cn'
import { MAX_FAVOURITES } from '@/utils/constants'

export type MobileView = 'weather' | 'favourites'

interface MobileNavigationProps {
  view: MobileView
  onChange: (view: MobileView) => void
  favouriteCount: number
  /** Settings is not a view: it opens the settings dialog. */
  onOpenSettings: () => void
}

interface Tab {
  view: MobileView
  label: string
  icon: LucideIcon
}

const TABS: readonly Tab[] = [
  { view: 'weather', label: 'Weather', icon: CloudSun },
  { view: 'favourites', label: 'Favourites', icon: Star },
]

/**
 * Bottom tab bar for phones. From tablet width the persistent sidebar replaces it, so it is not rendered
 * (display: none, so it is also out of the tab order and the accessibility tree) at md and above.
 * The current tab is shown by a top bar, bolder text and aria-current — not by colour alone.
 */
export function MobileNavigation({ view, onChange, favouriteCount, onOpenSettings }: MobileNavigationProps) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map(({ view: tabView, label, icon: Icon }) => {
          const active = tabView === view
          const showCount = tabView === 'favourites' && favouriteCount > 0
          return (
            <li key={tabView}>
              <button
                type="button"
                onClick={() => onChange(tabView)}
                aria-current={active ? 'page' : undefined}
                aria-label={
                  showCount ? `${label}, ${favouriteCount} of ${MAX_FAVOURITES} saved` : undefined
                }
                className={cn(
                  'relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-2 text-xs transition-colors',
                  active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-brand"
                  />
                )}
                <span className="relative">
                  <Icon className={cn('size-5', active && 'text-brand')} aria-hidden="true" />
                  {showCount && (
                    <span
                      aria-hidden="true"
                      className="tabular absolute -top-1.5 left-full ml-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.625rem] leading-4 font-semibold text-primary-foreground"
                    >
                      {favouriteCount}
                    </span>
                  )}
                </span>
                <span aria-hidden={showCount ? 'true' : undefined}>{label}</span>
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-haspopup="dialog"
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium text-muted-foreground transition-colors"
          >
            <Settings className="size-5" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
