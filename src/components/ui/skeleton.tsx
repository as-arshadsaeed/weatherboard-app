import type * as React from 'react'

import { cn } from '@/utils/cn'

/** Placeholder block for content that is loading. Purely decorative, so hidden from assistive tech. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
