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

function namespaced(key: string): string {
  return `${KEY_PREFIX}${key}`
}

/** True while values are really being written to localStorage. */
export function isStoragePersistent(): boolean {
  return persistent
}

function readRaw(key: string): string | null {
  try {
    const value = window.localStorage.getItem(namespaced(key))
    persistent = true
    return value
  } catch {
    persistent = false
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
    persistent = true
  } catch {
    persistent = false
    memoryStore.set(key, raw)
  }
}

export function removeStoredValue(key: string): void {
  memoryStore.delete(key)
  try {
    window.localStorage.removeItem(namespaced(key))
  } catch {
    persistent = false
  }
}

/** Test helper: clears the in-memory fallback and resets the persistence flag. */
export function resetStorageStateForTests(): void {
  memoryStore.clear()
  persistent = true
}
