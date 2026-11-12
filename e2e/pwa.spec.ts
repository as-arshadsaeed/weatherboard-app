import { readFile, writeFile } from 'node:fs/promises'

import { expect, test, type BrowserContext, type Page } from '@playwright/test'

interface Manifest {
  id: string
  name: string
  short_name: string
  description: string
  start_url: string
  scope: string
  display: string
  theme_color: string
  background_color: string
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>
}

async function getManifest(page: Page): Promise<Manifest> {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href, 'index.html links a manifest').toBeTruthy()
  const response = await page.request.get(href!)
  expect(response.ok()).toBe(true)
  return (await response.json()) as Manifest
}

/** Wait until the worker is active AND controlling this page (it claims clients on first install). */
async function waitForServiceWorkerControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
}

test.describe('web app manifest', () => {
  test('has every required field, in standalone display', async ({ page }) => {
    await page.goto('/')
    const manifest = await getManifest(page)

    expect(manifest.name).toBe('WeatherBoard')
    expect(manifest.short_name).toBe('WeatherBoard')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.id).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.description.length).toBeGreaterThan(20)
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  test('serves with a manifest content type', async ({ page }) => {
    await page.goto('/')
    const response = await page.request.get('/manifest.webmanifest')
    expect(response.headers()['content-type']).toMatch(/manifest\+json|application\/json/)
  })

  test('lists 192×192 and 512×512 icons that really are PNGs of those sizes, plus a maskable one', async ({ page }) => {
    await page.goto('/')
    const manifest = await getManifest(page)

    const expectIcon = async (sizes: string, purpose: string) => {
      const icon = manifest.icons.find((i) => i.sizes === sizes && (i.purpose ?? 'any') === purpose)
      expect(icon, `${sizes} ${purpose} icon is declared`).toBeDefined()
      expect(icon!.type).toBe('image/png')
      const response = await page.request.get(icon!.src)
      expect(response.ok(), icon!.src).toBe(true)
      const bytes = await response.body()
      expect(bytes.subarray(1, 4).toString(), 'PNG signature').toBe('PNG')
      const [w, h] = sizes.split('x').map(Number)
      // The PNG IHDR chunk stores the real pixel size at fixed offsets.
      expect(bytes.readUInt32BE(16), `${icon!.src} width`).toBe(w)
      expect(bytes.readUInt32BE(20), `${icon!.src} height`).toBe(h)
    }
    await expectIcon('192x192', 'any')
    await expectIcon('512x512', 'any')
    await expectIcon('512x512', 'maskable')
  })

  test('the Apple touch icon is a 180×180 PNG', async ({ page }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    const bytes = await (await page.request.get(href!)).body()
    expect(bytes.readUInt32BE(16)).toBe(180)
    expect(bytes.readUInt32BE(20)).toBe(180)
  })

  test('theme_color and background_color match the design token (they cannot drift apart)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const manifest = await getManifest(page)
    const rendered = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--background')
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return '#' + [r, g, b].map((v) => v!.toString(16).padStart(2, '0')).join('')
    })
    expect(manifest.background_color.toLowerCase()).toBe(rendered)
    expect(manifest.theme_color.toLowerCase()).toBe(rendered)
    await expect(page.locator('meta[name="theme-color"][media*="light"]')).toHaveAttribute('content', rendered)
  })

  test('the browser theme colour follows a manual theme switch', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const colours = () => page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')))
    expect(await colours()).toEqual(['#f8fafc', '#f8fafc'])
    await page.getByRole('button', { name: /switch to dark/i }).click()
    expect(await colours()).toEqual(['#0a0c11', '#0a0c11'])
    await page.reload()
    expect(await colours()).toEqual(['#0a0c11', '#0a0c11']) // pre-paint script restores it
  })
})

test.describe('installability', () => {
  test('Chromium reports no installability errors', async ({ page, context }) => {
    await page.goto('/')
    await waitForServiceWorkerControl(page)
    const client = await context.newCDPSession(page)
    const { installabilityErrors } = await client.send('Page.getInstallabilityErrors')
    expect(installabilityErrors, JSON.stringify(installabilityErrors)).toEqual([])
  })
})

test.describe('service worker', () => {
  test('registers, activates and controls the page, with root scope', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto('/')
    await waitForServiceWorkerControl(page)

    const info = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return { scope: reg.scope, state: reg.active?.state, script: reg.active?.scriptURL, waiting: reg.waiting !== null }
    })
    expect(new URL(info.scope).pathname).toBe('/')
    expect(info.state).toBe('activated')
    expect(new URL(info.script!).pathname).toBe('/sw.js')
    expect(info.waiting).toBe(false)
    expect(errors).toEqual([])
  })

  test('precaches the app shell and every static asset type under a versioned cache', async ({ page }) => {
    await page.goto('/')
    await waitForServiceWorkerControl(page)
    const cached = await page.evaluate(async () => {
      const names = await caches.keys()
      const urls: string[] = []
      for (const name of names) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname)
      return { names, urls }
    })
    expect(cached.names.some((n) => /precache/.test(n)), `cache names: ${cached.names}`).toBe(true)
    expect(cached.urls).toContain('/index.html')
    expect(cached.urls.some((u) => /\/assets\/index-.*\.js$/.test(u))).toBe(true)
    expect(cached.urls.some((u) => /\/assets\/index-.*\.css$/.test(u))).toBe(true)
    expect(cached.urls.some((u) => u.endsWith('.woff2'))).toBe(true)
    expect(cached.urls).toContain('/icons/icon-192.png')
    expect(cached.urls).toContain('/manifest.webmanifest')
  })

  test('announces, once, that the app can now open offline (without overpromising)', async ({ page }) => {
    await page.goto('/')
    const notice = page.getByRole('status').filter({ hasText: 'can now open without a connection' })
    await expect(notice).toBeVisible({ timeout: 15_000 })
    await expect(notice).toContainText('only for cities you have already viewed')
    await page.getByRole('button', { name: 'Dismiss offline-ready notice' }).click()
    await expect(notice).toHaveCount(0)
  })

  test('the built worker has versioning, cleanup, an SPA fallback — and does not cache weather', async () => {
    const worker = await readFile('dist/sw.js', 'utf8')
    expect(worker).toContain('precacheAndRoute') // versioned (hashed) precache
    expect(worker).toContain('cleanupOutdatedCaches') // old versions removed on activation
    expect(worker).toContain('/index.html') // offline navigation fallback
    expect(worker).toContain('SKIP_WAITING') // updates wait for the user
    // Weather staleness must be visible to the app, so the worker must never cache API responses.
    expect(worker).not.toMatch(/open-meteo|wft-geo-db/)
    expect(worker).not.toContain('registerRoute(/')
  })
})

test.describe('offline app shell', () => {
  async function goOffline(context: BrowserContext) {
    await context.setOffline(true)
  }

  test('reloading while offline still opens the app', async ({ page, context }) => {
    await page.goto('/')
    await waitForServiceWorkerControl(page)

    await goOffline(context)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'No city selected' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Search for a city' })).toBeVisible()
    await expect(page.getByRole('button', { name: /switch to/i })).toBeVisible()
  })

  test('deep links also open offline (navigation fallback)', async ({ page, context }) => {
    await page.goto('/')
    await waitForServiceWorkerControl(page)
    await goOffline(context)
    await page.goto('/?lat=51.5&lon=-0.12&name=London')
    await expect(page.getByRole('heading', { level: 1, name: /London/ })).toBeVisible()
  })

  test('styles and fonts come from the cache: the offline page is fully styled', async ({ page, context }) => {
    await page.goto('/')
    await waitForServiceWorkerControl(page)
    await goOffline(context)
    await page.reload()
    const styled = await page.evaluate(() => {
      const heading = document.querySelector('h1')!
      return { font: getComputedStyle(heading).fontFamily, bg: getComputedStyle(document.body).backgroundColor }
    })
    expect(styled.font).toContain('Inter')
    expect(styled.bg).not.toBe('rgba(0, 0, 0, 0)')
  })
})

test.describe('service worker updates', () => {
  // These tests briefly change the served dist/sw.js to simulate a new release, so they must not overlap.
  test.describe.configure({ mode: 'serial' })

  const SW_PATH = 'dist/sw.js'
  let originalWorker = ''

  /** Make the server return a byte-different worker, exactly as a new deployment would. */
  async function publishNewVersion() {
    originalWorker = await readFile(SW_PATH, 'utf8')
    await writeFile(SW_PATH, `${originalWorker}\n// e2e: simulated new version ${Date.now()}`)
  }
  test.afterEach(async () => {
    if (originalWorker) await writeFile(SW_PATH, originalWorker)
    originalWorker = ''
  })

  const checkForUpdate = (page: Page) =>
    page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update())
  const waitingWorker = (page: Page) =>
    page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting != null)

  test('a new version waits, is offered (never forced), and "Later" keeps the current one running', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await waitForServiceWorkerControl(page)

    await publishNewVersion()
    await checkForUpdate(page)

    const prompt = page.getByRole('status').filter({ hasText: 'A new version of WeatherBoard is ready.' })
    await expect(prompt).toBeVisible({ timeout: 15_000 })
    await expect(prompt).toContainText('saved cities and settings are kept')
    // It is only offered: the new worker is installed but waiting, and the page has not reloaded itself.
    expect(await waitingWorker(page)).toBe(true)
    await expect(page.getByRole('heading', { level: 1, name: 'No city selected' })).toBeVisible()

    await page.getByRole('button', { name: 'Later' }).click()
    await expect(prompt).toHaveCount(0)
    expect(await waitingWorker(page)).toBe(true) // still waiting; nothing was activated behind the user's back
    expect(errors).toEqual([])
  })

  test('"Reload" activates the new version and reloads; nothing is left waiting', async ({ page }) => {
    await page.goto('/')
    await waitForServiceWorkerControl(page)
    await publishNewVersion()
    await checkForUpdate(page)
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible({ timeout: 15_000 })

    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Reload' }).click()
    await reloaded

    await waitForServiceWorkerControl(page)
    await expect.poll(() => waitingWorker(page)).toBe(false)
    await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0)
    await expect(page.getByText('A new version of WeatherBoard is ready.')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'No city selected' })).toBeVisible()
  })

  test('after an update the app still opens offline (the new precache is complete)', async ({ page, context }) => {
    await page.goto('/')
    await waitForServiceWorkerControl(page)
    await publishNewVersion()
    await checkForUpdate(page)
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible({ timeout: 15_000 })
    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Reload' }).click()
    await reloaded
    await waitForServiceWorkerControl(page)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'No city selected' })).toBeVisible()
  })
})
