import type { BeforeSendEvent } from '@vercel/analytics/react'

/**
 * Whether Vercel Web Analytics should run in this build. Strictly opt-in, so deploying this code changes
 * nothing for visitors until someone deliberately turns it on.
 *
 * - Off unless `VITE_ANALYTICS=on` (set it for the Production environment only).
 * - Even when on, never in a build Vercel reports as `preview` or `development`, so a variable that was
 *   accidentally applied to every environment cannot send preview traffic to the production numbers.
 *   (`vercelEnv` is empty when Vercel's system environment variables are not exposed to the build, or off Vercel.)
 *
 * Local builds, tests and previews therefore never send data.
 */
export function isAnalyticsEnabled(flag: string | undefined, vercelEnv: string | undefined): boolean {
  if (flag?.trim().toLowerCase() !== 'on') return false
  return vercelEnv !== 'preview' && vercelEnv !== 'development'
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
