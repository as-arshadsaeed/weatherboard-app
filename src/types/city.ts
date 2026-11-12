/** A location the user can view weather for. */
export interface City {
  /** Stable identifier (used later for favourites and duplicate prevention). */
  id: string
  name: string
  region?: string
  country?: string
  latitude: number
  longitude: number
  /** IANA timezone (e.g. "Europe/London"). When absent, Open-Meteo resolves it from the coordinates. */
  timezone?: string
}
