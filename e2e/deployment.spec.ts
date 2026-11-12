import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { expect, test, type Page } from '@playwright/test'

import { API_GLOB, forecastBody, LONDON_URL } from './support/openMeteo.ts'
import { waitForServiceWorkerControl } from './support/serviceWorker.ts'
import { DIST, distPaths, headersFor, loadHeaderRules, startVercelSim } from './support/vercelSim.ts'

/**
 * Production-deployment checks. The app is served by a local SIMULATION of Vercel's header rules (see
 * support/vercelSim.ts), so these prove our rules and our build agree, not what Vercel's edge sends.
 */
const run = promisify(execFile)
const SCRIPT = path.resolve(import.meta.dirname, '../scripts/check-deployment.mjs')
const checkDeployment = (url: string) =>
  run('node', [SCRIPT, url]).then(
    ({ stdout }) => ({ code: 0, out: stdout }),
    (error: { code: number; stdout: string }) => ({ code: error.code, out: error.stdout }),
  )

let sim: Awaited<ReturnType<typeof startVercelSim>>
test.beforeAll(async () => {
  sim = await startVercelSim()
})
test.afterAll(async () => {
  await sim.close()
})

const FINGERPRINT = /-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/

test.describe('header rules (vercel.json) against the built files', () => {
  test('every file under /assets is fingerprinted and cached immutably', async () => {
    const rules = await loadHeaderRules()
    const assets = (await distPaths()).filter((p) => p.startsWith('/assets/'))
    expect(assets.length).toBeGreaterThan(10)
    for (const file of assets) {
      expect(file, 'immutable caching is only safe for content-hashed names').toMatch(FINGERPRINT)
      expect(headersFor(rules, file)['cache-control'], file).toBe('public, max-age=31536000, immutable')
    }
  })

  test('nothing outside /assets is ever cached immutably', async () => {
    const rules = await loadHeaderRules()
    for (const file of (await distPaths()).filter((p) => !p.startsWith('/assets/'))) {
      expect(headersFor(rules, file)['cache-control'] ?? '', file).not.toMatch(/immutable|max-age=[1-9]/)
    }
  })

  test('the shell, worker, worker import and manifest always revalidate', async () => {
    const rules = await loadHeaderRules()
    for (const file of ['/', '/index.html', '/sw.js', '/sw-notifications.js', '/manifest.webmanifest']) {
      expect(headersFor(rules, file)['cache-control'], file).toBe('public, max-age=0, must-revalidate')
    }
    // The worker imports sw-notifications.js; an HTTP-cached copy would stop updates reaching users.
    expect(await distPaths()).toEqual(expect.arrayContaining(['/sw.js', '/sw-notifications.js', '/manifest.webmanifest', '/index.html']))
  })

  test('the manifest is served as application/manifest+json', async () => {
    expect(headersFor(await loadHeaderRules(), '/manifest.webmanifest')['content-type']).toBe('application/manifest+json')
  })

  test('every response gets the security headers', async () => {
    const rules = await loadHeaderRules()
    for (const file of ['/', '/sw.js', '/assets/x-AAAAAAAA.js', '/icons/icon-192.png']) {
      const h = headersFor(rules, file)
      expect(h['x-content-type-options'], file).toBe('nosniff')
      expect(h['x-frame-options'], file).toBe('DENY')
      expect(h['referrer-policy'], file).toBeTruthy()
      expect(h['permissions-policy'], file).toBeTruthy()
    }
  })

  test('the service worker contains no weather API URLs and no runtime caching', async () => {
    const worker = await readFile(path.join(DIST, 'sw.js'), 'utf8')
    expect(worker).not.toMatch(/api\.open-meteo\.com|geocoding-api\.open-meteo|wft-geo-db/)
    expect(worker).not.toMatch(/registerRoute\([^)]*fetch|StaleWhileRevalidate|NetworkFirst|CacheFirst/)
  })
})

test.describe('production bundle', () => {
  test('the Lottie player and animations are lazy chunks, not part of the entry bundle', async () => {
    const html = await readFile(path.join(DIST, 'index.html'), 'utf8')
    const entry = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1]
    expect(entry, 'index.html references the entry script').toBeTruthy()
    const code = await readFile(path.join(DIST, entry!), 'utf8')
    // "bodymovin" appears only inside the player itself (our own loadAnimation call is legitimately in the entry).
    expect(code, 'the player must not be bundled into the entry').not.toContain('bodymovin')
    // A growing entry bundle is the early warning for an accidental static import (it is ~390 KB today).
    expect(Buffer.byteLength(code)).toBeLessThan(450 * 1024)

    const files = await distPaths()
    expect(files.filter((f) => /\/assets\/lottie_light-/.test(f))).toHaveLength(1)
    const animations = ['sun', 'moon', 'cloud', 'cloud-sun', 'cloud-moon', 'fog', 'drizzle', 'rain', 'heavy-rain', 'snow', 'snowflake', 'thunderstorm', 'hail']
    for (const name of animations) {
      expect(files.some((f) => new RegExp(`/assets/${name}-[A-Za-z0-9_-]{8}\\.js$`).test(f)), `${name} animation is shipped`).toBe(true)
    }
  })
})

test.describe('scripts/check-deployment.mjs', () => {
  test('passes against the simulated Vercel rules', async () => {
    const { code, out } = await checkDeployment(sim.url)
    expect(out).not.toMatch(/FAIL/)
    expect(code).toBe(0)
    expect(out).toMatch(/\d+\/\d+ checks passed\./)
  })

  test('fails against a server that lacks the rules (so it can actually catch a bad deployment)', async ({ baseURL }) => {
    // `vite preview` (the e2e server) serves the same files without vercel.json's headers.
    const { code, out } = await checkDeployment(baseURL!)
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL.*immutable/)
    expect(out).toMatch(/FAIL.*security header/)
  })

  test('answers 2 (usage) without a URL, and sends no request', async () => {
    const result = await run('node', [SCRIPT]).then(() => 0, (e: { code: number }) => e.code)
    expect(result).toBe(2)
  })
})

function watch(page: Page) {
  const problems: string[] = []
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`))
  return problems
}

for (const viewport of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`production smoke test (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('loads, shows weather and animations, with no errors and no failed requests', async ({ page }) => {
      const problems = watch(page)
      await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
      await page.goto(`${sim.url}${LONDON_URL}`)
      await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
      await expect(page.locator('main [data-weather-icon]:visible .lottie-icon svg')).toHaveCount(6)
      await waitForServiceWorkerControl(page)
      expect(problems).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
    })
  })
}

test.describe('service worker in production conditions', () => {
  test('registers, serves the manifest and icons, and reloads offline with saved weather and animations', async ({ page, context }) => {
    const problems = watch(page)
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.goto(`${sim.url}${LONDON_URL}`)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await waitForServiceWorkerControl(page)

    // The real responses a browser got, with the rules applied.
    // (The page's response events do not see the worker script's own fetch, so request it directly.)
    const worker = await page.request.get(`${sim.url}/sw.js`)
    expect(worker.headers()['cache-control']).toBe('public, max-age=0, must-revalidate')
    expect(worker.headers()['content-type']).toMatch(/javascript/)
    const manifest = await page.request.get(`${sim.url}/manifest.webmanifest`)
    expect(manifest.headers()['content-type']).toContain('application/manifest+json')
    expect(((await manifest.json()) as { icons: unknown[] }).icons).toHaveLength(3)
    expect((await page.request.get(`${sim.url}/icons/icon-512.png`)).status()).toBe(200)
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => /precache/.test(k)))).toBe(true)

    // The saved snapshot is written once the forecast has been fetched and shown.
    await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === 'weatherboard'))).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Saved weather' })).toBeVisible()
    await expect(page.getByText('You’re offline. Showing saved weather.')).toBeVisible()
    // The animations come from the precache, so they still play with no network.
    await expect(page.locator('main [data-weather-icon]:visible .lottie-icon svg')).toHaveCount(6)

    // Offline reloads are expected to fail API/network calls only; nothing else may.
    expect(problems.filter((p) => !/open-meteo|ERR_INTERNET_DISCONNECTED/.test(p))).toEqual([])
  })

  test('unknown paths are a plain 404, never the app shell or a stale asset', async ({ page }) => {
    const response = await page.goto(`${sim.url}/assets/index-ZZZZZZZZ.js`)
    expect(response?.status()).toBe(404)
  })
})
