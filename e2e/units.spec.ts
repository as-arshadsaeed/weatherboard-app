import { expect, test, type Page } from '@playwright/test'

import { API_GLOB, forecastBody, LONDON_URL } from './support/openMeteo.ts'

async function mockWeather(page: Page) {
  const requests: string[] = []
  await page.route(API_GLOB, (route) => {
    requests.push(route.request().url())
    return route.fulfill({ json: forecastBody() })
  })
  return requests
}

const celsius = (page: Page) => page.getByRole('button', { name: 'Celsius (°C)' })
const fahrenheit = (page: Page) => page.getByRole('button', { name: 'Fahrenheit (°F)' })

test.describe('temperature unit', () => {
  test('defaults to Celsius, then converts every visible temperature when switched', async ({ page }) => {
    await mockWeather(page)
    await page.goto(LONDON_URL)

    await expect(celsius(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()

    await fahrenheit(page).click()
    await expect(fahrenheit(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(celsius(page)).toHaveAttribute('aria-pressed', 'false')

    // 6.7°C → 44°F (current), feels like 2.9 → 37, high 8.4 → 47, low 4.7 → 40
    await expect(page.getByLabel('44 degrees Fahrenheit')).toBeVisible()
    await expect(page.getByLabel('37°F', { exact: true })).toBeVisible()
    await expect(page.getByLabel('47°F', { exact: true })).toBeVisible()
    await expect(page.getByLabel('40°F', { exact: true })).toBeVisible()
    // Forecast: Saturday 9.3°C / 0.1°C → 49°F / 32°F
    await expect(page.getByRole('listitem', { name: 'Saturday 14 November' })).toContainText('49°')
    await expect(page.getByLabel('High 49°F, low 32°F')).toBeVisible()
    // Never mixed: no Celsius left in the weather content.
    await expect(page.locator('main').getByLabel(/Celsius|\d°C/)).toHaveCount(0)

    await celsius(page).click()
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
  })

  test('is remembered after a reload and never refetches the weather', async ({ page }) => {
    const requests = await mockWeather(page)
    await page.goto(LONDON_URL)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()

    await fahrenheit(page).click()
    await celsius(page).click()
    await fahrenheit(page).click()
    expect(requests).toHaveLength(1)
    expect(await page.evaluate(() => localStorage.getItem('weatherboard:unit'))).toBe('"fahrenheit"')

    await page.reload()
    await expect(page.getByLabel('44 degrees Fahrenheit')).toBeVisible()
    await expect(fahrenheit(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('a corrupted saved value falls back to Celsius without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('weatherboard:unit', '"kelvin"'))
    await mockWeather(page)
    await page.goto(LONDON_URL)
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await expect(celsius(page)).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
  })

  test('still works in the session when localStorage is blocked', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      const deny = () => {
        throw new DOMException('blocked', 'SecurityError')
      }
      Storage.prototype.getItem = deny
      Storage.prototype.setItem = deny
      Storage.prototype.removeItem = deny
    })
    await mockWeather(page)
    await page.goto(LONDON_URL)
    await fahrenheit(page).click()
    await expect(page.getByLabel('44 degrees Fahrenheit')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('keyboard: Tab to a unit and press Space/Enter', async ({ page }) => {
    await mockWeather(page)
    await page.goto(LONDON_URL)
    await fahrenheit(page).focus()
    await page.keyboard.press('Space')
    await expect(page.getByLabel('44 degrees Fahrenheit')).toBeVisible()
    await celsius(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
  })

  for (const vp of [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ]) {
    test(`header fits at ${vp.name} (${vp.width}px) in both themes, with no overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await mockWeather(page)
      await page.goto(LONDON_URL)
      for (const mode of ['light', 'dark']) {
        if (mode === 'dark') await page.getByRole('button', { name: /switch to dark/i }).click()
        await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /dark/ : /^(?!.*dark)/)
        const { sw, cw } = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }))
        expect(sw).toBeLessThanOrEqual(cw)
        for (const target of [celsius(page), fahrenheit(page)]) {
          const box = (await target.boundingBox())!
          expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
          if (vp.width < 768) {
            expect(box.width).toBeGreaterThanOrEqual(44)
            expect(box.height).toBeGreaterThanOrEqual(44)
          }
        }
        if (process.env.SCREENSHOT_DIR) {
          await fahrenheit(page).click()
          await page.waitForTimeout(500) // let the colour transition settle
          await page.mouse.move(0, 400)
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/units-${vp.name}-${mode}.png` })
          await celsius(page).click()
        }
      }
    })
  }
})
