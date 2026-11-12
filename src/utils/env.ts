/** GeoDB key if configured. Read at call time; empty/whitespace counts as "not configured". */
export function getGeoDbApiKey(): string | undefined {
  const key = import.meta.env.VITE_GEODB_API_KEY?.trim()
  return key ? key : undefined
}
