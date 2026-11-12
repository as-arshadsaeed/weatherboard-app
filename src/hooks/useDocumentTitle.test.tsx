import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useDocumentTitle } from '@/hooks/useDocumentTitle'

afterEach(() => (document.title = ''))

describe('useDocumentTitle', () => {
  it('is the app name with no subject', () => {
    renderHook(() => useDocumentTitle(null))
    expect(document.title).toBe('WeatherBoard')
  })

  it('names the subject and follows changes', () => {
    const { rerender } = renderHook(({ subject }: { subject: string | null }) => useDocumentTitle(subject), {
      initialProps: { subject: 'London' as string | null },
    })
    expect(document.title).toBe('London · WeatherBoard')
    rerender({ subject: 'Paris' })
    expect(document.title).toBe('Paris · WeatherBoard')
    rerender({ subject: null })
    expect(document.title).toBe('WeatherBoard')
  })

  it('restores the app name when unmounted', () => {
    renderHook(() => useDocumentTitle('London')).unmount()
    expect(document.title).toBe('WeatherBoard')
  })
})
