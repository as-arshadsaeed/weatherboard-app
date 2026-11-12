import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { API_GLOB, forecastBody, LONDON_URL } from './support/openMeteo.ts'
import { waitForServiceWorkerControl } from './support/serviceWorker.ts'

/**
 * Vercel Web Analytics. The real @vercel/analytics package runs in the browser; the script it would download
 * from Vercel is replaced by a stub (the real intake cannot exist outside Vercel), so these tests prove OUR
 * integration (once, redacted, optional, harmless) and say nothing about data reaching the Vercel dashboard.
 */
const WITH_ANALYTICS = 'http://localhost:4174' // built with VITE_ANALYTICS=on
const SCRIPT_GLOB = '**/_vercel/insights/script.js'
const VIEW_GLOB = '**/_vercel/insights/view'

/**
 * Stand-in for Vercel's script: like the real one it reads the beforeSend hook the app registered and
 * applies it to a page view before "sending" it (to /view, which tests capture).
 */
const STUB_SCRIPT = `
  const queue = window.vaq || [];
  const hook = (queue.find((entry) => entry[0] === 'beforeSend') || [])[1];
  const event = hook ? hook({ type: 'pageview', url: location.href }) : { type: 'pageview', url: location.href };
  if (event) fetch('/_vercel/insights/view', { method: 'POST', body: JSON.stringify(event) });
`

async function trackAnalytics(page: Page) {
  const scriptRequests: string[] = []
  const views: Array<{ url: string }> = []
  await page.route(SCRIPT_GLOB, (route) => {
    scriptRequests.push(route.request().url())
    return route.fulfill({ contentType: 'text/javascript', body: STUB_SCRIPT })
  })
  await page.route(VIEW_GLOB, (route) => {
    views.push(JSON.parse(route.request().postData() ?? '{}'))
    return route.fulfill({ status: 200, body: '' })
  })
  await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
  return { scriptRequests, views }
}

const problems = (page: Page) => {
  const list: string[] = []
  page.on('pageerror', (error) => list.push(error.message))
  return list
}

test.describe('with analytics switched on', () => {
  test('loads the script exactly once and reports one page view', async ({ page }) => {
    const { scriptRequests, views } = await trackAnalytics(page)
    await page.goto(`${WITH_ANALYTICS}/`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(() => views.length).toBe(1)

    expect(scriptRequests).toHaveLength(1)
    expect(await page.locator('script[src*="/_vercel/insights/script.js"]').count()).toBe(1)
  })

  test('a deep link’s coordinates and city name never leave the browser', async ({ page }) => {
    const { views } = await trackAnalytics(page)
    const requests: string[] = []
    page.on('request', (request) => requests.push(`${request.url()} ${request.postData() ?? ''}`))
    await page.goto(`${WITH_ANALYTICS}${LONDON_URL}`)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await expect.poll(() => views.length).toBe(1)

    expect(views[0]!.url).toBe(`${WITH_ANALYTICS}/`)
    const toAnalytics = requests.filter((r) => /_vercel\/insights/.test(r))
    expect(toAnalytics.length).toBeGreaterThan(0)
    for (const request of toAnalytics) expect(request).not.toMatch(/lat=|lon=|51\.5|London|United%20Kingdom/)
  })

  test('is not blocked by, and does not block, the weather and search requests', async ({ page }) => {
    await trackAnalytics(page)
    const weather: string[] = []
    page.on('request', (request) => /api\.open-meteo\.com\/v1\/forecast/.test(request.url()) && weather.push(request.url()))
    await page.goto(`${WITH_ANALYTICS}${LONDON_URL}`)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await expect(page.locator('main [data-weather-icon]:visible .lottie-icon svg')).toHaveCount(6)
    expect(weather).toHaveLength(1)
  })

  test('the app still works when the analytics script is blocked (ad blocker, privacy mode, outage)', async ({ page }) => {
    const errors = problems(page)
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.route(SCRIPT_GLOB, (route) => route.abort('blockedbyclient'))
    await page.goto(`${WITH_ANALYTICS}${LONDON_URL}`)

    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await expect(page.locator('main [data-weather-icon]:visible .lottie-icon svg')).toHaveCount(6)
    await page.getByRole('button', { name: 'Fahrenheit (°F)' }).first().click()
    await expect(page.getByText(/degrees Fahrenheit/).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the app still works when the analytics script is broken', async ({ page }) => {
    const errors = problems(page)
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.route(SCRIPT_GLOB, (route) => route.fulfill({ status: 500, body: 'nope' }))
    await page.goto(`${WITH_ANALYTICS}${LONDON_URL}`)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('city search keeps working', async ({ page }) => {
    await trackAnalytics(page)
    await page.route('**/geocoding-api.open-meteo.com/**', (route) => route.fulfill({ json: { results: [] } }))
    await page.route('**/wft-geo-db.p.rapidapi.com/**', (route) => route.fulfill({ json: { data: [] } }))
    await page.goto(`${WITH_ANALYTICS}/`)
    await page.getByRole('combobox', { name: 'Search for a city' }).fill('zzqx')
    await expect(page.getByText('No cities found', { exact: false }).first()).toBeVisible()
  })
})

test.describe('PWA, service worker and offline with analytics on', () => {
  test('the worker never intercepts analytics, registers, and the app reloads offline without it', async ({ page, context }) => {
    const errors = problems(page)
    const { scriptRequests } = await trackAnalytics(page)
    await page.goto(`${WITH_ANALYTICS}${LONDON_URL}`)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await waitForServiceWorkerControl(page)
    expect(scriptRequests).toHaveLength(1)

    // Offline reload: the shell comes from the precache and nothing tries to start analytics.
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Saved weather' })).toBeVisible()
    await expect(page.locator('main [data-weather-icon]:visible .lottie-icon svg')).toHaveCount(6)
    expect(scriptRequests).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test('the service worker contains no analytics URLs, so it can never cache or serve them', async () => {
    const worker = await readFile(path.resolve(import.meta.dirname, '../dist-analytics/sw.js'), 'utf8')
    expect(worker).not.toMatch(/insights|vercel-scripts|va\.vercel/)
  })
})

test.describe('with analytics off (the default build: previews, local runs, tests)', () => {
  test('nothing is injected and nothing is requested', async ({ page, baseURL }) => {
    const analyticsRequests: string[] = []
    page.on('request', (request) => /insights|vercel-scripts|va\.vercel/.test(request.url()) && analyticsRequests.push(request.url()))
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.goto(`${baseURL}${LONDON_URL}`)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await page.waitForTimeout(300)

    expect(analyticsRequests).toEqual([])
    expect(await page.locator('script[src*="insights"], script[src*="vercel-scripts"]').count()).toBe(0)
    expect(await page.evaluate(() => typeof (window as unknown as { va?: unknown }).va)).toBe('undefined')
  })
})
