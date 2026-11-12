import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Whether the browser believes it is online. `false` is reliable; `true` only means a network
 * interface is up, not that the internet is reachable — so requests can still fail while "online",
 * and callers must handle that (the weather hook falls back to saved data in that case too).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
