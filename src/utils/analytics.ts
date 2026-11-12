import type { BeforeSendEvent } from '@vercel/analytics/react'

/**
 * Whether Vercel Web Analytics should run in this build.
 *
 * - `VITE_ANALYTICS=on` / `off` is an explicit switch (set it for the Production environment only).
 * - Otherwise it is on only for a Vercel *production* build (`VERCEL_ENV=production`, which Vercel exposes
 *   to builds when the project's system environment variables are enabled).
 *
 * Local builds, tests and preview deployments therefore never send data unless someone opts in, so they
 * cannot pollute production numbers.
 */
export function isAnalyticsEnabled(flag: string | undefined, vercelEnv: string | undefined): boolean {
  const choice = flag?.trim().toLowerCase()
  if (choice === 'on') return true
  if (choice === 'off') return false
  return vercelEnv === 'production'
}

/**
 * Runs on every event just before it leaves the browser. Only the page's path is kept: deep links such as
 * `/?lat=51.5&lon=-0.12&name=London` carry a city's coordinates, which must never be sent. An event whose
 * URL cannot be parsed is dropped rather than sent as-is. No custom events or properties are ever sent.
 */
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url)
    url.search = ''
    url.hash = ''
    return { ...event, url: url.toString() }
  } catch {
    return null
  }
}
