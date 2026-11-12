import { expect, test, type Page, type Route } from '@playwright/test'

import {
  geoDbBody,
  geoDbCity,
  GEODB_GLOB,
  GEOCODING_GLOB,
  LONDON,
  LONDON_CA,
  LONDRINA,
  openMeteoGeocodingBody,
} from './support/geocoding.ts'
import { API_GLOB, forecastBody } from './support/openMeteo.ts'

const searchBox = (page: Page) => page.getByRole('combobox', { name: 'Search for a city' })

/** Intercept the forecast API (always succeeds) and record its URLs. */
async function mockForecast(page: Page) {
  const urls: string[] = []
  await page.route(API_GLOB, (route) => {
    urls.push(route.request().url())
    return route.fulfill({ json: forecastBody() })
  })
  return urls
}

/** Intercept GeoDB with a handler and record requests (URL + headers). */
async function mockGeoDb(page: Page, handler: (route: Route, url: URL) => Promise<void> | void) {
  const requests: Array<{ url: URL; headers: Record<string, string> }> = []
  await page.route(GEODB_GLOB, (route) => {
    const url = new URL(route.request().url())
    requests.push({ url, headers: route.request().headers() })
    return handler(route, url)
  })
  return requests
}

async function mockGeocoding(page: Page, handler: (route: Route, url: URL) => Promise<void> | void) {
  const urls: URL[] = []
  await page.route(GEOCODING_GLOB, (route) => {
    const url = new URL(route.request().url())
    urls.push(url)
    return handler(route, url)
  })
  return urls
}

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::|status of 4|status of 5/.test(msg.text())) {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

test.describe('GeoDB autocomplete', () => {
  test('suggests cities, sends the key, caps at 6, and selecting loads that city’s weather', async ({ page }) => {
    const errors = trackErrors(page)
    const forecasts = await mockForecast(page)
    const eight = Array.from({ length: 8 }, (_, i) => geoDbCity(10 + i, `Londonville ${i}`, 'Region', 'Country', 10 + i, 20 + i))
    const geoDb = await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([LONDON, LONDON_CA, LONDRINA, ...eight]) }))

    await page.goto('/')
    await searchBox(page).fill('lon')
    const options = page.getByRole('option')
    await expect(options).toHaveCount(6) // capped even though 11 came back
    await expect(options.first()).toContainText('London')
    await expect(options.first()).toContainText('England, United Kingdom')

    expect(geoDb).toHaveLength(1)
    expect(geoDb[0]!.headers['x-rapidapi-key']).toBe('e2e-test-key')
    expect(geoDb[0]!.headers['x-rapidapi-host']).toBe('wft-geo-db.p.rapidapi.com')
    expect(geoDb[0]!.url.searchParams.get('namePrefix')).toBe('lon')
    expect(geoDb[0]!.url.searchParams.get('limit')).toBe('6')

    await options.nth(2).click() // Londrina
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Londrina' })).toBeVisible()
    await expect(page.getByText('Paraná, Brazil')).toBeVisible()
    const forecast = new URL(forecasts.at(-1)!)
    expect(forecast.searchParams.get('latitude')).toBe('-23.3103')
    expect(forecast.searchParams.get('longitude')).toBe('-51.1628')
    expect(errors).toEqual([])
  })

  test('works entirely from the keyboard: type, arrows, Enter', async ({ page }) => {
    const forecasts = await mockForecast(page)
    await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([LONDON, LONDON_CA, LONDRINA]) }))

    await page.goto('/')
    await searchBox(page).focus()
    await page.keyboard.type('lon')
    await expect(page.getByRole('option')).toHaveCount(3)
    await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { selected: true })).toContainText('Londrina')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { level: 1, name: 'Londrina' })).toBeVisible()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    expect(forecasts).toHaveLength(1)
  })

  test('Escape and clicking outside both close the suggestions', async ({ page }) => {
    await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([LONDON, LONDON_CA]) }))
    await page.goto('/')
    await searchBox(page).fill('lon')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)

    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('listbox')).toBeVisible()
    // Click somewhere the overlay does not cover (the Favourites card).
    await page.getByRole('heading', { name: 'Favourites' }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })
})

test.describe('debounce and request cancellation', () => {
  test('rapid typing sends one request for the final text', async ({ page }) => {
    const geoDb = await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([LONDON]) }))
    await page.goto('/')
    await searchBox(page).focus()
    await page.keyboard.type('london', { delay: 40 })
    await expect(page.getByRole('option')).toHaveCount(1)
    await page.waitForTimeout(400)
    expect(geoDb).toHaveLength(1)
    expect(geoDb[0]!.url.searchParams.get('namePrefix')).toBe('london')
  })

  test('a slow response for old text never overwrites results for the new text', async ({ page }) => {
    await mockGeoDb(page, async (route, url) => {
      const prefix = url.searchParams.get('namePrefix')
      if (prefix === 'lon') {
        await new Promise((r) => setTimeout(r, 1500)) // slow, will be superseded
        return route.fulfill({ json: geoDbBody([LONDRINA]) })
      }
      return route.fulfill({ json: geoDbBody([LONDON]) })
    })

    await page.goto('/')
    await searchBox(page).fill('lon')
    await page.waitForTimeout(350) // debounce fires → slow request in flight
    await searchBox(page).fill('lond')
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(page.getByRole('option').first()).toContainText('London')

    await page.waitForTimeout(1600) // the stale response has now arrived
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(page.getByRole('option').first()).toContainText('London')
    await expect(page.getByText('Londrina')).toHaveCount(0)
  })
})

test.describe('Open-Meteo geocoding fallback', () => {
  const OM = [
    { id: 2643743, name: 'London', admin1: 'England', country: 'United Kingdom', latitude: 51.50853, longitude: -0.12574, timezone: 'Europe/London' },
  ]

  for (const [label, handler] of [
    ['rate limit (429)', (r: Route) => r.fulfill({ status: 429, body: '' })],
    ['outage (503)', (r: Route) => r.fulfill({ status: 503, body: '' })],
    ['unreachable service', (r: Route) => r.abort('failed')],
    ['malformed payload', (r: Route) => r.fulfill({ json: { nope: true } })],
  ] as const) {
    test(`falls back transparently when GeoDB fails: ${label}`, async ({ page }) => {
      const forecasts = await mockForecast(page)
      await mockGeoDb(page, handler)
      const fallback = await mockGeocoding(page, (route) => route.fulfill({ json: openMeteoGeocodingBody(OM) }))

      await page.goto('/')
      await searchBox(page).fill('lon')
      await expect(page.getByRole('option')).toHaveCount(1)
      await expect(page.getByRole('option').first()).toContainText('London')
      expect(fallback).toHaveLength(1)
      expect(fallback[0]!.searchParams.get('name')).toBe('lon')

      await page.getByRole('option').first().click()
      await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
      // The fallback supplies the city's timezone, which is passed on to the weather request.
      expect(new URL(forecasts.at(-1)!).searchParams.get('timezone')).toBe('Europe/London')
    })
  }

  test('an empty GeoDB result is final: no fallback request is made', async ({ page }) => {
    await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([]) }))
    const fallback = await mockGeocoding(page, (route) => route.fulfill({ json: openMeteoGeocodingBody(OM) }))
    await page.goto('/')
    await searchBox(page).fill('zzqx')
    await expect(page.getByText('No cities found. Try another spelling or search by country.').first()).toBeVisible()
    expect(fallback).toHaveLength(0)
  })
})

test.describe('states', () => {
  test('no results: a visible, helpful message', async ({ page }) => {
    await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([]) }))
    await page.goto('/')
    await searchBox(page).fill('zzqx')
    await expect(page.getByText('No cities found. Try another spelling or search by country.').first()).toBeVisible()
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })

  test('loading: shows "Searching…" while a request is in flight', async ({ page }) => {
    await mockGeoDb(page, async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      await route.fulfill({ json: geoDbBody([LONDON]) })
    })
    await page.goto('/')
    await searchBox(page).fill('lon')
    await expect(page.getByText('Searching…').first()).toBeVisible()
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(page.getByText('Searching…')).toHaveCount(0)
  })

  test('network failure on both providers: specific message, then recovery via "Try again"', async ({ page }) => {
    const errors = trackErrors(page)
    await mockGeoDb(page, (route) => route.abort('failed'))
    await mockGeocoding(page, (route) => route.abort('failed'))

    await page.goto('/')
    await searchBox(page).fill('lon')
    await expect(
      page.getByText('Unable to search cities. Check your internet connection and try again.').first(),
    ).toBeVisible()
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0)

    await page.unroute(GEODB_GLOB)
    await page.route(GEODB_GLOB, (route) => route.fulfill({ json: geoDbBody([LONDON]) }))
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('option')).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test('service outage on both providers: temporary-unavailable message', async ({ page }) => {
    await mockGeoDb(page, (route) => route.fulfill({ status: 503, body: '' }))
    await mockGeocoding(page, (route) => route.fulfill({ status: 503, body: '' }))
    await page.goto('/')
    await searchBox(page).fill('lon')
    await expect(
      page.getByText('City search is temporarily unavailable. Please try again.').first(),
    ).toBeVisible()
  })
})

test.describe('validation', () => {
  test('empty input shows an inline error on blur and makes no request', async ({ page }) => {
    const geoDb = await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([]) }))
    await page.goto('/')
    await searchBox(page).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByText('Enter a city name to search.')).toBeVisible()
    await expect(searchBox(page)).toHaveAttribute('aria-invalid', 'true')
    expect(geoDb).toHaveLength(0)
  })

  test('one character shows guidance and makes no request', async ({ page }) => {
    const geoDb = await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([]) }))
    await page.goto('/')
    await searchBox(page).fill('l')
    await expect(page.getByText('Type at least 2 characters to search for a city.').first()).toBeVisible()
    await page.waitForTimeout(400)
    expect(geoDb).toHaveLength(0)
  })

  test('free text can never be submitted: Enter without a suggestion changes nothing', async ({ page }) => {
    const forecasts = await mockForecast(page)
    await mockGeoDb(page, async (route) => {
      await new Promise((r) => setTimeout(r, 600))
      await route.fulfill({ json: geoDbBody([LONDON]) })
    })
    await page.goto('/')
    await searchBox(page).fill('london')
    await page.keyboard.press('Enter') // suggestions have not arrived yet
    await page.waitForTimeout(100)
    expect(forecasts).toHaveLength(0)
    await expect(page.getByText('No city selected')).toBeVisible()
  })
})

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`responsive: ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('suggestion panel stays inside the viewport, with no overflow, and touch-friendly options', async ({ page }, testInfo) => {
      const errors = trackErrors(page)
      await mockForecast(page)
      await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([LONDON, LONDON_CA, LONDRINA]) }))

      await page.goto('/')
      await searchBox(page).fill('lon')
      const listbox = page.getByRole('listbox')
      await expect(listbox).toBeVisible()

      const box = (await listbox.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width)

      const { sw, cw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }))
      expect(sw).toBeLessThanOrEqual(cw)

      for (const option of await page.getByRole('option').all()) {
        expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      const input = (await searchBox(page).boundingBox())!
      expect(input.height).toBeGreaterThanOrEqual(vp.width < 768 ? 44 : 40)

      if (process.env.SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/search-${vp.name}-open.png` })
        await page.getByRole('option').first().click()
        await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/search-${vp.name}-selected.png` })
      }
      expect(errors, testInfo.title).toEqual([])
    })
  })
}

test('weather requests are not repeated when only the theme changes after searching', async ({ page }) => {
  const forecasts = await mockForecast(page)
  await mockGeoDb(page, (route) => route.fulfill({ json: geoDbBody([LONDON]) }))
  await page.goto('/')
  await searchBox(page).fill('lon')
  await page.getByRole('option').first().click()
  await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
  await page.getByRole('button', { name: /switch to dark/i }).click()
  expect(forecasts).toHaveLength(1)
})
