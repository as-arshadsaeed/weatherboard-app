import type { ReactNode } from 'react'

/**
 * Quick-access column. Sits beside the dashboard from tablet width up and
 * stacks below it on mobile (the DOM order keeps the main content first for screen readers).
 */
export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside
      aria-label="Saved cities"
      className="md:order-first md:sticky md:top-[5.5rem] md:self-start"
    >
      {children}
    </aside>
  )
}
