import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

function setOnLine(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

afterEach(() => vi.restoreAllMocks())

describe('useOnlineStatus', () => {
  it('reflects the browser’s state when it first renders', () => {
    setOnLine(true)
    expect(renderHook(() => useOnlineStatus()).result.current).toBe(true)
    setOnLine(false)
    expect(renderHook(() => useOnlineStatus()).result.current).toBe(false)
  })

  it('updates when the connection is lost and when it returns', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('stops listening after unmount', () => {
    setOnLine(true)
    const remove = vi.spyOn(window, 'removeEventListener')
    renderHook(() => useOnlineStatus()).unmount()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
