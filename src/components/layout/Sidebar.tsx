import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface SidebarProps {
  children: ReactNode
  className?: string
  /**
   * On a phone's Favourites view the weather <main> is hidden, so this panel is the page's content: it
   * becomes the main landmark and gets a level-one heading. Otherwise it is a complementary landmark.
   */
  asMain?: boolean
}

/**
 * Quick-access column. Sits beside the dashboard from tablet width up (it is the navigation there)
 * and, on mobile, is the "Favourites" view selected from the bottom bar. The DOM order keeps the
 * main content first for screen readers.
 */
export function Sidebar({ children, className, asMain = false }: SidebarProps) {
  const classes = cn('min-w-0 md:order-first md:sticky md:top-[5.5rem] md:self-start', className)

  if (asMain) {
    return (
      <div role="main" aria-label="Favourite cities" className={classes}>
        <h1 className="sr-only">Favourite cities</h1>
        {children}
      </div>
    )
  }
  return (
    <aside aria-label="Saved cities" className={classes}>
      {children}
    </aside>
  )
}
