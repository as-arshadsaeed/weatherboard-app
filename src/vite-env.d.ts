/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** GeoDB Cities (RapidAPI) key. PUBLIC once built; restrict it provider-side. Optional: search falls back to Open-Meteo. */
  readonly VITE_GEODB_API_KEY?: string
  /** "on" enables Vercel Web Analytics (opt-in; ignored by Vercel preview builds). Not a secret. Unset = off. */
  readonly VITE_ANALYTICS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Vercel's VERCEL_ENV at build time ("production" | "preview" | "development"), or "" outside Vercel. Set in vite.config.ts. */
declare const __VERCEL_ENV__: string
