import type { ReactNode } from 'react'

interface SpokenProps {
  /** What assistive technology reads, e.g. "7 degrees Celsius". */
  spoken: string
  /** What is shown, e.g. "7°C". Hidden from assistive technology so it is not read twice. */
  children: ReactNode
  className?: string
  visualClassName?: string
}

/**
 * Shows a compact visual value and gives screen readers the full spoken form as real text.
 *
 * Use this instead of `aria-label` on a <p>, <span> or <dd>: ARIA does not allow naming those (generic)
 * elements, so many screen readers ignore the label — and because the visual copy is aria-hidden, they would
 * then read nothing at all. Real visually-hidden text is read reliably, in reading order.
 */
export function Spoken({ spoken, children, className, visualClassName }: SpokenProps) {
  return (
    <span className={className}>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true" className={visualClassName}>
        {children}
      </span>
    </span>
  )
}
