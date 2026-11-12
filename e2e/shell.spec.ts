import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

/** Collect console errors and uncaught exceptions for the lifetime of a page. */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('renders without console errors or horizontal overflow', async ({ page }, testInfo) => {
      const errors = trackErrors(page)
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'No city selected' })).toBeVisible()
      if (vp.width < 768) {
        // Phones: favourites are one tap away behind the bottom bar, not stacked under the weather.
        await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
        await expect(page.getByRole('region', { name: 'Favourites' })).toBeHidden()
      } else {
        await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
        await expect(page.getByRole('region', { name: 'Favourites' })).toBeVisible()
      }

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

      if (process.env.SCREENSHOT_DIR) {
        await page.screenshot({
          path: `${process.env.SCREENSHOT_DIR}/${vp.name}-light.png`,
          fullPage: true,
        })
        await page.getByRole('button', { name: /switch to dark theme/i }).click()
        await page.waitForTimeout(500) // let the icon transition settle
        await page.mouse.move(0, 0)
        await page.screenshot({
          path: `${process.env.SCREENSHOT_DIR}/${vp.name}-dark.png`,
          fullPage: true,
        })
      }
      expect(errors, testInfo.title).toEqual([])
    })

    test('has no overlapping header controls', async ({ page }) => {
      await page.goto('/')
      const boxes = await Promise.all(
        [
          page.getByRole('link', { name: 'WeatherBoard' }),
          page.getByRole('combobox', { name: 'Search for a city' }),
          page.getByRole('button', { name: /switch to/i }),
        ].map((l) => l.boundingBox()),
      )
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!
          const b = boxes[j]!
          const overlap =
            a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
          expect(overlap, `header items ${i} and ${j} overlap`).toBe(false)
        }
      }
    })
  })
}

test.describe('header order', () => {
  test('tablet/desktop read logo → search → units → theme toggle from left to right, matching tab order', async ({ page }) => {
    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      const x = async (locator: ReturnType<Page['getByRole']>) => (await locator.boundingBox())!.x
      const logo = await x(page.getByRole('link', { name: 'WeatherBoard' }))
      const search = await x(page.getByRole('combobox', { name: 'Search for a city' }))
      const celsius = await x(page.getByRole('button', { name: 'Celsius (°C)' }))
      const fahrenheit = await x(page.getByRole('button', { name: 'Fahrenheit (°F)' }))
      const toggle = await x(page.getByRole('button', { name: /switch to/i }))
      expect(logo, `logo before search at ${width}px`).toBeLessThan(search)
      expect(search, `search before units at ${width}px`).toBeLessThan(celsius)
      expect(celsius).toBeLessThan(fahrenheit)
      expect(fahrenheit, `units before theme at ${width}px`).toBeLessThan(toggle)
    }
  })

  test('mobile: logo and theme toggle share the first row, search spans its own row below', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const logo = (await page.getByRole('link', { name: 'WeatherBoard' }).boundingBox())!
    const toggle = (await page.getByRole('button', { name: /switch to/i }).boundingBox())!
    const fahrenheit = (await page.getByRole('button', { name: 'Fahrenheit (°F)' }).boundingBox())!
    const search = (await page.getByRole('combobox', { name: 'Search for a city' }).boundingBox())!
    expect(toggle.x).toBeGreaterThan(logo.x + logo.width)
    expect(fahrenheit.x + fahrenheit.width).toBeLessThanOrEqual(toggle.x) // units sit just left of the theme toggle
    expect(Math.abs(fahrenheit.y + fahrenheit.height / 2 - (logo.y + logo.height / 2))).toBeLessThan(12)
    expect(Math.abs(toggle.y + toggle.height / 2 - (logo.y + logo.height / 2))).toBeLessThan(12)
    expect(search.y).toBeGreaterThan(logo.y + logo.height)
    expect(search.width).toBeGreaterThan(375 - 40) // full width minus gutters
  })
})

test.describe('mobile touch targets', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('interactive controls are at least 44x44px', async ({ page }) => {
    await page.goto('/')
    for (const locator of [
      page.getByRole('button', { name: /switch to/i }),
      page.getByRole('button', { name: 'Celsius (°C)' }),
      page.getByRole('button', { name: 'Fahrenheit (°F)' }),
      page.getByRole('combobox', { name: 'Search for a city' }),
    ]) {
      const box = await locator.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('theme', () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })

  test('follows the OS on first visit, then a manual choice persists across reloads', async ({
    page,
  }) => {
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)

    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(html).not.toHaveClass(/dark/)

    await page.reload()
    await expect(html).not.toHaveClass(/dark/)
    expect(await page.evaluate(() => localStorage.getItem('weatherboard:theme'))).toBe('"light"')
  })

  test('applies the saved theme before first paint (no flash)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('weatherboard:theme', '"light"'))
    await page.goto('/')
    // The pre-paint script in index.html runs before React mounts.
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      false,
    )
  })
})

test.describe('keyboard', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('skip link is first in tab order and moves focus to main', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  test('focus indicator is visible on the theme toggle', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: /switch to/i })
    await page.keyboard.press('Tab') // skip link
    await page.keyboard.press('Tab') // logo
    await page.keyboard.press('Tab') // city search
    await page.keyboard.press('Tab') // °C
    await page.keyboard.press('Tab') // °F
    await page.keyboard.press('Tab') // theme toggle
    await expect(toggle).toBeFocused()
    const outline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).toBe('solid')
  })
})
