/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** GeoDB Cities (RapidAPI) key. PUBLIC once built; restrict it provider-side. Optional: search falls back to Open-Meteo. */
  readonly VITE_GEODB_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
