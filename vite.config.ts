import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

/** Resolved from the --background design token (light / dark); kept in sync by e2e/pwa.spec.ts. */
const THEME_COLOR_LIGHT = '#f8fafc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": a new version waits until the user chooses to reload, so an update can never
      // reload the page (or lose an open dialog) unexpectedly.
      registerType: 'prompt',
      // We register from src/pwa/serviceWorker.ts so state (update available / offline ready) can drive the UI.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'WeatherBoard',
        short_name: 'WeatherBoard',
        description: 'Live weather, five-day forecasts and favourite cities, available offline for places you have viewed.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        lang: 'en',
        categories: ['weather', 'utilities'],
        theme_color: THEME_COLOR_LIGHT,
        background_color: THEME_COLOR_LIGHT,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + every static asset (including all font subsets) are precached with content
        // hashes, so offline loads never depend on a runtime cache.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Any navigation (including ?lat=&lon= deep links) gets the SPA shell when offline.
        navigateFallback: '/index.html',
        // Delete precaches left by previous app versions when the new worker activates.
        cleanupOutdatedCaches: true,
        // Clicking a reminder notification focuses/opens the app (see public/sw-notifications.js).
        importScripts: ['sw-notifications.js'],
        // Take control of the first page load; later updates still wait for the user ("prompt").
        clientsClaim: true,
        // Weather is deliberately NOT cached by the worker: the app keeps it in IndexedDB so it can
        // label saved data with its age. A worker cache would serve stale forecasts as if live.
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    // Lets the app know it is a Vercel *production* build (analytics is off for previews and local builds).
    // Empty when system environment variables are not exposed to the build, or outside Vercel.
    __VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? ''),
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    exclude: ['e2e/**', 'node_modules/**'],
    alias: {
      // The real module only exists inside a Vite build; tests use a controllable stub.
      'virtual:pwa-register': path.resolve(import.meta.dirname, 'src/test/stubs/pwa-register.ts'),
    },
  },
})
