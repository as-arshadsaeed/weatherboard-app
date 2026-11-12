/**
 * Safe wrapper around localStorage.
 *
 * Browsers can throw on access (private modes, blocked site data, quota) and
 * stored values can be corrupted or edited by hand. Every operation here
 * therefore degrades to an in-memory store instead of throwing, and reads are
 * validated so a bad value is discarded rather than trusted.
 */

const KEY_PREFIX = 'weatherboard:'

const memoryStore = new Map<string, string>()
let persistent = true
const statusListeners = new Set<() => void>()

function namespaced(key: string): string {
  return `${KEY_PREFIX}${key}`
}

/** True while values are really being written to localStorage. */
export function isStoragePersistent(): boolean {
  return persistent
}

/**
 * Subscribe to persistence status changes (for useSyncExternalStore). Notifications are deferred
 * to a microtask so a read performed during render never updates another component mid-render.
 */
export function subscribeToStorageStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

function setPersistent(next: boolean): void {
  if (persistent === next) return
  persistent = next
  queueMicrotask(() => statusListeners.forEach((listener) => listener()))
}

/**
 * Check up front whether writes work, so the "preferences will not persist" notice can show before
 * the user's first save instead of only after it silently fails.
 */
export function probeStorage(): void {
  const probeKey = namespaced('__probe')
  try {
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    setPersistent(true)
  } catch {
    setPersistent(false)
  }
}

function readRaw(key: string): string | null {
  try {
    // A successful read says nothing about whether writes work, so it never flips the status back.
    return window.localStorage.getItem(namespaced(key))
  } catch {
    setPersistent(false)
    return memoryStore.get(key) ?? null
  }
}

/**
 * Read and validate a stored value. Returns `fallback` when the key is absent,
 * unreadable, not valid JSON, or rejected by `validate` (corrupt entries are removed).
 */
export function getStoredValue<T>(
  key: string,
  validate: (value: unknown) => value is T,
  fallback: T,
): T
export function getStoredValue<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T | null
export function getStoredValue<T>(
  key: string,
  validate: (value: unknown) => value is T,
  fallback: T | null = null,
): T | null {
  const raw = readRaw(key)
  if (raw === null) return fallback

  try {
    const parsed: unknown = JSON.parse(raw)
    if (validate(parsed)) return parsed
  } catch {
    // fall through to cleanup
  }
  removeStoredValue(key)
  return fallback
}

export function setStoredValue(key: string, value: unknown): void {
  const raw = JSON.stringify(value)
  try {
    window.localStorage.setItem(namespaced(key), raw)
    memoryStore.delete(key)
    setPersistent(true)
  } catch {
    setPersistent(false)
    memoryStore.set(key, raw)
  }
}

export function removeStoredValue(key: string): void {
  memoryStore.delete(key)
  try {
    window.localStorage.removeItem(namespaced(key))
  } catch {
    setPersistent(false)
  }
}

/** Test helper: clears the in-memory fallback and resets the persistence flag. */
export function resetStorageStateForTests(): void {
  memoryStore.clear()
  persistent = true
}
