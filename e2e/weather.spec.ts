import { expect, test, type Page } from '@playwright/test'

import { API_GLOB, forecastBody, LONDON_URL } from './support/openMeteo.ts'

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    // The browser logs failed network requests we deliberately provoke; those are expected.
    if (msg.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(msg.text())) {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

async function mockWeather(page: Page) {
  const requests: string[] = []
  await page.route(API_GLOB, (route) => {
    requests.push(route.request().url())
    return route.fulfill({ json: forecastBody() })
  })
  return requests
}

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('renders current weather and five-day forecast without overflow or console errors', async ({ page }) => {
      const errors = trackErrors(page)
      await mockWeather(page)
      await page.goto(LONDON_URL)

      await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
      await expect(page.getByText('England, United Kingdom')).toBeVisible()
      await expect(page.getByText('7 degrees Celsius')).toBeVisible()
      await expect(page.getByText('Partly cloudy', { exact: true })).toBeVisible()
      await expect(page.locator('main').getByRole('listitem')).toHaveCount(5)
      await expect(page.getByText('Weather data by Open-Meteo.com')).toBeVisible()

      const { sw, cw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }))
      expect(sw).toBeLessThanOrEqual(cw)

      // Forecast cards must not overlap each other.
      const boxes = await page.locator('main').getByRole('listitem').evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })),
      )
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!
          const b = boxes[j]!
          const overlap = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1
          expect(overlap, `cards ${i} and ${j} overlap`).toBe(false)
        }
      }
      if (process.env.SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/weather-${vp.name}-light.png`, fullPage: true })
        await page.getByRole('button', { name: /switch to dark/i }).click()
        await page.waitForTimeout(500)
        await page.mouse.move(0, 0)
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/weather-${vp.name}-dark.png`, fullPage: true })
      }
      expect(errors).toEqual([])
    })
  })
}

test.describe('forecast layout', () => {
  test('is five columns on desktop and a single stacked column on mobile', async ({ page }) => {
    await mockWeather(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(LONDON_URL)
    const desktopTops = await page.locator('main').getByRole('listitem').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(desktopTops).size).toBe(1)

    await page.setViewportSize({ width: 375, height: 812 })
    const mobileTops = await page.locator('main').getByRole('listitem').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(mobileTops).size).toBe(5)
  })
})

test.describe('loading state', () => {
  test('shows the real city name with a status message and no weather values, then loads', async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route(API_GLOB, async (route) => {
      await gate
      await route.fulfill({ json: forecastBody() })
    })
    await page.goto(LONDON_URL)

    await expect(page.getByRole('status').filter({ hasText: 'Loading weather' })).toContainText('Loading weather for London')
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/\d\s*°/)

    release()
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Loading weather' })).toHaveCount(0)
  })

  test('does not shift the layout noticeably when data arrives', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route(API_GLOB, async (route) => {
      await gate
      await route.fulfill({ json: forecastBody() })
    })
    await page.goto(LONDON_URL)
    await expect(page.getByRole('status').filter({ hasText: 'Loading weather' })).toBeVisible()
    const mainBefore = await page.locator('main').evaluate((el) => el.getBoundingClientRect().height)

    release()
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    const mainAfter = await page.locator('main').evaluate((el) => el.getBoundingClientRect().height)
    expect(Math.abs(mainAfter - mainBefore)).toBeLessThanOrEqual(24)
  })
})

test.describe('failure states', () => {
  test('network failure shows a specific message and recovers via "Try again"', async ({ page }) => {
    const errors = trackErrors(page)
    await page.route(API_GLOB, (route) => route.abort('failed'))
    await page.goto(LONDON_URL)

    await expect(page.getByRole('alert')).toHaveText(
      'Unable to retrieve weather data. Check your internet connection and try again.',
    )
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0)

    await page.unroute(API_GLOB)
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('service outage shows an unavailable message', async ({ page }) => {
    await page.route(API_GLOB, (route) => route.fulfill({ status: 503, body: '' }))
    await page.goto(LONDON_URL)
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  })

  test('API rejecting the location shows "unavailable for this location" with no retry', async ({ page }) => {
    await page.route(API_GLOB, (route) =>
      route.fulfill({ status: 400, json: { error: true, reason: 'Latitude must be in range of -90 to 90°.' } }),
    )
    await page.goto(LONDON_URL)
    await expect(page.getByRole('alert')).toHaveText('Weather data is unavailable for this location.')
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  })

  test('invalid coordinates are rejected without any network request', async ({ page }) => {
    const requests = await mockWeather(page)
    await page.goto('/?lat=999&lon=0&name=Nowhere')
    await expect(page.getByRole('alert')).toHaveText('Weather data is unavailable for this location.')
    expect(requests).toHaveLength(0)
  })

  test('a malformed API payload is never displayed as weather', async ({ page }) => {
    await page.route(API_GLOB, (route) => route.fulfill({ json: { hello: 'world' } }))
    await page.goto(LONDON_URL)
    await expect(page.getByRole('alert')).toContainText('could not be read')
    await expect(page.getByText(/degrees/)).toHaveCount(0)
  })
})

test.describe('no unnecessary API calls', () => {
  test('switching theme does not refetch weather', async ({ page }) => {
    const requests = await mockWeather(page)
    await page.goto(LONDON_URL)
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()

    await page.getByRole('button', { name: /switch to dark/i }).click()
    await page.getByRole('button', { name: /switch to light/i }).click()
    expect(requests).toHaveLength(1)
  })

  test('requests the city timezone and 5 forecast days', async ({ page }) => {
    const requests = await mockWeather(page)
    await page.goto(`${LONDON_URL}&tz=Europe/London`)
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    const url = new URL(requests[0]!)
    expect(url.searchParams.get('timezone')).toBe('Europe/London')
    expect(url.searchParams.get('forecast_days')).toBe('5')
  })
})

test.describe('accessibility', () => {
  test('weather is exposed with named landmarks, headings and labelled values', async ({ page }) => {
    await mockWeather(page)
    await page.goto(LONDON_URL)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '5-day forecast' })).toBeVisible()
    await expect(page.getByRole('listitem', { name: 'Saturday 14 November' })).toContainText('Light rain')
    await expect(page.getByText('82 percent chance of precipitation')).toBeVisible()
  })

  test('animation is disabled when the user prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockWeather(page)
    await page.goto(LONDON_URL)
    const icon = page.locator('main svg.animate-weather-float, main svg.animate-weather-spin').first()
    await expect(icon).toBeVisible()
    const duration = await icon.evaluate((el) => getComputedStyle(el).animationDuration)
    expect(parseFloat(duration)).toBeLessThan(0.01)
  })
})

test.describe('detail cards', () => {
  const card = (page: Page, label: string) =>
    page.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=..')

  test('show humidity, wind, precipitation, sunrise and sunset from the API', async ({ page }) => {
    await mockWeather(page)
    await page.goto(LONDON_URL)
    await expect(page.getByRole('heading', { level: 2, name: 'Today’s details' })).toBeVisible()

    await expect(card(page, 'Humidity')).toContainText('64%')
    await expect(card(page, 'Wind speed')).toContainText('12 km/h')
    await expect(card(page, 'Wind direction')).toContainText('From N')
    await expect(card(page, 'Precipitation')).toContainText('0%')
    await expect(card(page, 'Sunrise')).toContainText(/0?7:13/)
    await expect(card(page, 'Sunset')).toContainText(/(4:15 PM|16:15)/)
  })

  test('missing values read "Not available" and never break the rest of the dashboard', async ({ page }) => {
    const body = forecastBody()
    // Widen the types: the API can legally send null/empty for these fields.
    const current: Record<string, unknown> = body.current
    const daily: Record<string, unknown> = body.daily
    current.relative_humidity_2m = null
    current.wind_speed_10m = null
    current.apparent_temperature = null
    daily.precipitation_probability_max = [null, null, null, null, null]
    daily.sunrise = ['', '', '', '', '']
    await page.route(API_GLOB, (route) => route.fulfill({ json: body }))
    await page.goto(LONDON_URL)

    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    await expect(card(page, 'Humidity')).toContainText('Not available')
    await expect(card(page, 'Wind speed')).toContainText('Not available')
    await expect(card(page, 'Precipitation')).toContainText('Not available')
    await expect(card(page, 'Sunrise')).toContainText('Not available')
    await expect(card(page, 'Feels like')).toContainText('Not available')
    await expect(card(page, 'Sunset')).toContainText(/(4:15 PM|16:15)/) // unaffected
    await expect(page.locator('main').getByRole('listitem')).toHaveCount(5)
  })

  test('loading skeleton reserves the details space (no large layout shift)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route(API_GLOB, async (route) => {
      await gate
      await route.fulfill({ json: forecastBody() })
    })
    await page.goto(LONDON_URL)
    await expect(page.getByRole('status').filter({ hasText: 'Loading weather' })).toBeVisible()
    const before = await page.locator('main').evaluate((el) => el.getBoundingClientRect().height)
    release()
    await expect(card(page, 'Humidity')).toBeVisible()
    const after = await page.locator('main').evaluate((el) => el.getBoundingClientRect().height)
    expect(Math.abs(after - before)).toBeLessThanOrEqual(24)
  })
})
