import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// A second build with Vercel Analytics switched on (the default build has it off, as in previews and local runs).
const ANALYTICS_PORT = 4174

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Test the real production build, not the dev server.
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      // A dummy key so the GeoDB path is active in the build under test. It overrides any real key in
      // .env (shell env wins in Vite), and tests intercept every geocoding request, so nothing real is called.
      env: { VITE_GEODB_API_KEY: 'e2e-test-key' },
      timeout: 120_000,
    },
    {
      // Same app with VITE_ANALYTICS=on, built into its own folder so it cannot disturb the main build.
      command: `npx vite build --outDir dist-analytics && npx vite preview --outDir dist-analytics --port ${ANALYTICS_PORT} --strictPort`,
      url: `http://localhost:${ANALYTICS_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: { VITE_GEODB_API_KEY: 'e2e-test-key', VITE_ANALYTICS: 'on' },
      timeout: 120_000,
    },
  ],
})
