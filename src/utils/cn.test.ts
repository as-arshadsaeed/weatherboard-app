import { describe, expect, it } from 'vitest'

import { cn } from '@/utils/cn'

describe('cn', () => {
  it('joins conditional classes and drops falsy values', () => {
    expect(cn('a', { b: false, d: true }, undefined, 'c')).toBe('a d c')
  })

  it('lets later Tailwind utilities override conflicting earlier ones', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4')
  })
})
