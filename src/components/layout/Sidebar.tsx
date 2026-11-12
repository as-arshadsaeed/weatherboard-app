import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

/**
 * Quick-access column. Sits beside the dashboard from tablet width up (it is the navigation there)
 * and, on mobile, is the "Favourites" view selected from the bottom bar. The DOM order keeps the
 * main content first for screen readers.
 */
export function Sidebar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      aria-label="Saved cities"
      className={cn('md:order-first md:sticky md:top-[5.5rem] md:self-start', className)}
    >
      {children}
    </aside>
  )
}
