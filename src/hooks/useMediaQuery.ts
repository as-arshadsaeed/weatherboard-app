import { useCallback, useSyncExternalStore } from 'react'

/** Whether a CSS media query currently matches, kept live as the viewport changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
