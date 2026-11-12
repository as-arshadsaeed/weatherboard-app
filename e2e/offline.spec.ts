import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { asFavourite, LONDON, mockApis, panel, search, seed, TOKYO } from './support/app.ts'
import { API_GLOB, forecastBody } from './support/openMeteo.ts'
import { waitForServiceWorkerControl } from './support/serviceWorker.ts'

const DEEP_LINK_PARIS = '/?lat=48.8534&lon=2.3488&name=Paris&country=France'

interface ForecastState {
  temp: number
  mode: 'ok' | 'outage' | 'abort'
}

/** Replace the mocked forecast with one whose temperature we control. */
async function useForecast(page: Page, state: ForecastState) {
  const requests: string[] = []
  await page.route(API_GLOB, (route) => {
    requests.push(route.request().url())
    if (state.mode === 'abort') return route.abort('failed')
    if (state.mode === 'outage') return route.fulfill({ status: 503, body: '' })
    const body = forecastBody()
    body.current.temperature_2m = state.temp
    return route.fulfill({ json: body })
  })
  return requests
}

interface StoredSnapshot {
  key: string
  city: { name: string }
  savedAt: number
  report: { current: { temperatureC: number } }
}

/** Read the app's own IndexedDB store. Never creates the database (that would break the app's schema). */
async function savedSnapshots(page: Page): Promise<StoredSnapshot[]> {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    if (!dbs.some((d) => d.name === 'weatherboard')) return []
    return new Promise<StoredSnapshot[]>((resolve) => {
      const open = indexedDB.open('weatherboard')
      open.onerror = () => resolve([])
      open.onsuccess = () => {
        const db = open.result
        if (!db.objectStoreNames.contains('weather-snapshots')) {
          db.close()
          return resolve([])
        }
        const get = db.transaction('weather-snapshots').objectStore('weather-snapshots').getAll()
        get.onsuccess = () => {
          db.close()
          resolve(get.result as StoredSnapshot[])
        }
        get.onerror = () => {
          db.close()
          resolve([])
        }
      }
    })
  })
}

/** Rewrite stored records in place (to plant old or corrupt data). */
async function rewriteSnapshots(page: Page, rewrite: 'age' | 'corrupt') {
  await page.evaluate(async (mode) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('weatherboard')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction('weather-snapshots', 'readwrite')
        const store = tx.objectStore('weather-snapshots')
        const all = store.getAll()
        all.onsuccess = () => {
          for (const record of all.result) {
            if (mode === 'age') store.put({ ...record, savedAt: Date.now() - 8 * 24 * 3_600_000 })
            else store.put({ ...record, report: { current: 'garbage' } })
          }
        }
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, rewrite)
}

/** View London online, wait until it is saved, and make sure the worker controls the page. */
async function viewLondonAndSave(page: Page) {
  await page.goto('/')
  await search(page, 'lon', /London/)
  await expect.poll(async () => (await savedSnapshots(page)).length).toBe(1)
  await waitForServiceWorkerControl(page)
}

const offlineBanner = (page: Page) => page.getByRole('status').filter({ hasText: 'You’re offline.' }).first()
const savedNotice = (page: Page) => page.getByRole('status', { name: 'Saved weather' })
const goOffline = (context: BrowserContext) => context.setOffline(true)

test.describe('viewing weather saves it, and it is available offline', () => {
  test('reload while offline shows the saved weather, labelled with its age, plus the offline banner', async ({ page, context }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const forecasts = await mockApis(page)
    await viewLondonAndSave(page)
    const [snapshot] = await savedSnapshots(page)
    expect(snapshot!.city.name).toBe('London')
    expect(snapshot!.report.current.temperatureC).toBe(6.7)
    const requestsWhileOnline = forecasts.length

    await goOffline(context)
    await page.reload()

    await expect(offlineBanner(page)).toBeVisible()
    await expect(offlineBanner(page)).toContainText('Weather you’ve viewed before is still available; other cities need a connection.')
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()

    const notice = savedNotice(page)
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('You’re offline. Showing saved weather.')
    await expect(notice).toContainText('Conditions may have changed since then.')
    await expect(notice).toContainText('It will update automatically when you’re back online.')
    // The timestamp is the real time the data was retrieved.
    const datetime = await notice.locator('time').getAttribute('datetime')
    expect(new Date(datetime!).getTime()).toBe(snapshot!.savedAt)
    await expect(notice).toContainText(/less than a minute ago|1 minute ago/)

    // The whole dashboard renders from the saved data.
    await expect(page.getByText('Humidity')).toBeVisible()
    await expect(page.locator('main').getByRole('listitem')).toHaveCount(5)
    await expect(page.getByText('Weather data by Open-Meteo.com')).toBeVisible()
    expect(forecasts.length).toBe(requestsWhileOnline) // it did not even try the network
    expect(errors).toEqual([])
  })

  test('saved weather stays available across repeated reloads', async ({ page, context }) => {
    await mockApis(page)
    await viewLondonAndSave(page)
    await goOffline(context)
    for (let i = 0; i < 3; i++) {
      await page.reload()
      await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
      await expect(savedNotice(page)).toBeVisible()
    }
  })

  test('the unit toggle still works on saved weather', async ({ page, context }) => {
    await mockApis(page)
    await viewLondonAndSave(page)
    await goOffline(context)
    await page.reload()
    await page.getByRole('button', { name: 'Fahrenheit (°F)' }).click()
    await expect(page.getByLabel('44 degrees Fahrenheit')).toBeVisible()
  })

  test('when the connection returns, fresh data replaces the saved data and what is saved is updated', async ({ page, context }) => {
    await mockApis(page)
    const forecast: ForecastState = { temp: 6.7, mode: 'ok' }
    await useForecast(page, forecast)
    await viewLondonAndSave(page)
    await goOffline(context)
    await page.reload()
    await expect(savedNotice(page)).toBeVisible()
    const savedBefore = (await savedSnapshots(page))[0]!.savedAt

    forecast.temp = 12.4 // the weather changed while we were away
    await context.setOffline(false)

    await expect(page.getByLabel('12 degrees Celsius')).toBeVisible()
    await expect(savedNotice(page)).toHaveCount(0)
    await expect(page.getByText('You’re back online.')).toBeVisible()
    await expect.poll(async () => (await savedSnapshots(page))[0]!.report.current.temperatureC).toBe(12.4)
    expect((await savedSnapshots(page))[0]!.savedAt).toBeGreaterThan(savedBefore)
    await expect(page.getByText('You’re back online.')).toHaveCount(0, { timeout: 8000 }) // confirmation is brief
  })

  test('losing the connection while viewing live weather switches to labelled saved weather', async ({ page, context }) => {
    await mockApis(page)
    await viewLondonAndSave(page)
    await expect(savedNotice(page)).toHaveCount(0) // live right now
    await goOffline(context)
    await expect(savedNotice(page)).toContainText('You’re offline. Showing saved weather.')
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible() // kept on screen, now honestly labelled
  })
})

test.describe('honesty about what is not available offline', () => {
  test('a city that was never viewed has no weather offline, and says so', async ({ page, context }) => {
    await mockApis(page)
    await seed(page, 'favourites', [asFavourite(LONDON), asFavourite(TOKYO)])
    await viewLondonAndSave(page)
    await goOffline(context)
    await page.reload()
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible() // London is saved

    const tokyo = panel(page).getByRole('button', { name: /^Tokyo/ })
    await tokyo.click()
    await expect(page.getByRole('alert')).toHaveText(
      'You’re offline, and no saved weather is available for this city. Connect to the internet to load it.',
    )
    await expect(page.getByRole('heading', { level: 1, name: /Tokyo/ })).toBeVisible()
    await expect(page.getByLabel(/degrees/)).toHaveCount(0) // nothing invented
    await expect(savedNotice(page)).toHaveCount(0)
    expect((await savedSnapshots(page)).map((s) => s.city.name)).toEqual(['London'])

    // …and once the connection returns it loads by itself.
    await context.setOffline(false)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await expect.poll(async () => (await savedSnapshots(page)).map((s) => s.city.name).sort()).toEqual(['London', 'Tokyo'])
  })

  test('failed or unreadable responses are never saved as weather', async ({ page, context }) => {
    await mockApis(page)
    const forecast: ForecastState = { temp: 6.7, mode: 'outage' }
    await useForecast(page, forecast)
    await page.goto(DEEP_LINK_PARIS)
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
    await waitForServiceWorkerControl(page)

    await page.unroute(API_GLOB)
    await page.route(API_GLOB, (route) => route.fulfill({ json: { hello: 'not a forecast' } }))
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('could not be read')

    expect(await savedSnapshots(page)).toEqual([])
    await goOffline(context)
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('no saved weather is available for this city')
  })

  test('data older than 7 days is not shown (and is removed)', async ({ page, context }) => {
    await mockApis(page)
    await viewLondonAndSave(page)
    await rewriteSnapshots(page, 'age')
    await goOffline(context)
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('no saved weather is available for this city')
    await expect(page.getByLabel(/degrees/)).toHaveCount(0)
    await expect.poll(async () => (await savedSnapshots(page)).length).toBe(0)
  })

  test('a corrupted record is ignored and removed instead of breaking the app or being shown', async ({ page, context }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await mockApis(page)
    await viewLondonAndSave(page)
    await rewriteSnapshots(page, 'corrupt')
    await goOffline(context)
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('no saved weather is available for this city')
    await expect.poll(async () => (await savedSnapshots(page)).length).toBe(0)
    expect(errors).toEqual([])
  })

  test('without IndexedDB the app still works online, and offline says there is nothing saved', async ({ page, context }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })
    })
    await mockApis(page)
    await page.goto('/')
    await search(page, 'lon', /London/)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await waitForServiceWorkerControl(page)

    await goOffline(context)
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('no saved weather is available for this city')
    expect(errors).toEqual([])
  })
})

test.describe('browser says online, but the weather service cannot be reached', () => {
  test('shows saved weather without claiming to be offline, and "Try again" fetches fresh data', async ({ page }) => {
    await mockApis(page)
    const forecast: ForecastState = { temp: 6.7, mode: 'ok' }
    await useForecast(page, forecast)
    await viewLondonAndSave(page)

    forecast.mode = 'abort'
    await page.reload()
    const notice = savedNotice(page)
    await expect(notice).toContainText('Can’t reach the weather service. Showing saved weather.')
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await expect(page.getByText('You’re offline.')).toHaveCount(0) // not offline: do not say so

    forecast.mode = 'ok'
    forecast.temp = 9.2
    await notice.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByLabel('9 degrees Celsius')).toBeVisible()
    await expect(savedNotice(page)).toHaveCount(0)
  })
})

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`offline layout: ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const mode of ['light', 'dark'] as const) {
      test(`saved-weather notice and offline banner fit in the ${mode} theme`, async ({ page, context }, testInfo) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await mockApis(page)
        await viewLondonAndSave(page)
        if (mode === 'dark') await page.getByRole('button', { name: /switch to dark/i }).click()
        await goOffline(context)
        await page.reload()
        await expect(savedNotice(page)).toBeVisible()
        await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /dark/ : /^(?!.*dark)/)

        const { sw, cw } = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }))
        expect(sw).toBeLessThanOrEqual(cw)
        for (const target of [offlineBanner(page), savedNotice(page)]) {
          const box = (await target.boundingBox())!
          expect(box.x).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
        }
        await page.mouse.move(0, 400)
        if (process.env.SCREENSHOT_DIR) {
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/offline-${vp.name}-${mode}.png` })
        }
        expect(errors, testInfo.title).toEqual([])
      })
    }

    test('"Try again" is a 44 px target on phones', async ({ page }) => {
      await mockApis(page)
      const forecast: ForecastState = { temp: 6.7, mode: 'ok' }
      await useForecast(page, forecast)
      await viewLondonAndSave(page)
      forecast.mode = 'abort'
      await page.reload()
      const retry = savedNotice(page).getByRole('button', { name: 'Try again' })
      await expect(retry).toBeVisible()
      const box = (await retry.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(vp.width < 768 ? 44 : 36)
    })
  })
}

for (const vp of [
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`notices do not break the page grid: ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('banner and saved-weather notice span the width above; the sidebar and weather stay side by side beneath', async ({ page, context }) => {
      await mockApis(page)
      await seed(page, 'favourites', [asFavourite(LONDON)])
      await viewLondonAndSave(page)
      await goOffline(context)
      await page.reload()
      await expect(offlineBanner(page)).toBeVisible()
      await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()

      const box = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!
      const banner = await box(offlineBanner(page))
      const sidebar = await box(panel(page))
      const main = await box(page.locator('main#main'))

      // Notices sit above everything, not squeezed into a column.
      expect(banner.y + banner.height).toBeLessThanOrEqual(Math.min(sidebar.y, main.y))
      expect(banner.width).toBeGreaterThan(vp.width * 0.6)
      // Sidebar left, weather right, starting at the same height: the page grid is intact.
      expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(main.x)
      expect(Math.abs(sidebar.y - main.y)).toBeLessThan(8)
      expect(main.width).toBeGreaterThan(sidebar.width * 1.5)
      // The saved-weather notice belongs to the weather column, not the sidebar.
      const notice = await box(savedNotice(page))
      expect(notice.x).toBeGreaterThanOrEqual(main.x - 1)
    })
  })
}

