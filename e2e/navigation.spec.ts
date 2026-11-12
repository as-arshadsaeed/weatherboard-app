import { expect, test, type Page } from '@playwright/test'

import {
  asFavourite,
  BERLIN,
  LONDON,
  mockApis,
  panel,
  PARIS,
  search,
  searchBox,
  seed,
  TOKYO,
} from './support/app.ts'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })
const tab = (page: Page, name: RegExp) => nav(page).getByRole('button', { name })
const main = (page: Page) => page.locator('main#main')

async function setup(page: Page, favourites = [LONDON, PARIS, TOKYO]) {
  const forecasts = await mockApis(page)
  await seed(page, 'favourites', favourites.map(asFavourite))
  await page.goto('/')
  return forecasts
}

test.describe('phone (375px): bottom tab bar', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('shows a fixed bottom bar with Weather and Favourites; Weather is current by default', async ({ page }) => {
    await setup(page)
    await expect(nav(page)).toBeVisible()
    await expect(tab(page, /^Weather/)).toHaveAttribute('aria-current', 'page')
    await expect(tab(page, /^Favourites/)).not.toHaveAttribute('aria-current')

    const box = (await nav(page).boundingBox())!
    expect(Math.round(box.y + box.height)).toBe(812) // pinned to the bottom edge
    expect(box.width).toBe(375)
    await expect(main(page)).toBeVisible()
    await expect(panel(page)).toBeHidden() // favourites are one tap away, not stacked below the weather
  })

  test('touch targets are at least 44×44 px', async ({ page }) => {
    await setup(page)
    for (const t of [tab(page, /^Weather/), tab(page, /^Favourites/)]) {
      const box = (await t.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
  })

  test('the Favourites tab swaps the view and shows the saved count', async ({ page }) => {
    await setup(page)
    await expect(tab(page, /^Favourites/)).toHaveAccessibleName('Favourites, 3 of 5 saved')
    await tab(page, /^Favourites/).click()

    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByRole('listitem')).toHaveCount(3)
    await expect(main(page)).toBeHidden()
    await expect(tab(page, /^Favourites/)).toHaveAttribute('aria-current', 'page')
    await expect(tab(page, /^Weather/)).not.toHaveAttribute('aria-current')

    await tab(page, /^Weather/).click()
    await expect(main(page)).toBeVisible()
    await expect(panel(page)).toBeHidden()
  })

  test('choosing a favourite returns to the weather, loads it, and moves focus to the content', async ({ page }) => {
    const forecasts = await setup(page)
    await tab(page, /^Favourites/).click()
    await panel(page).getByRole('button', { name: /^Tokyo/ }).click()

    await expect(main(page)).toBeVisible()
    await expect(page.getByLabel('7 degrees Celsius')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Tokyo' })).toBeVisible()
    await expect(panel(page)).toBeHidden()
    await expect(tab(page, /^Weather/)).toHaveAttribute('aria-current', 'page')
    expect(new URL(forecasts.at(-1)!).searchParams.get('latitude')).toBe('35.6895')
    // The control that was used just disappeared, so focus must not be stranded on it.
    await expect(main(page)).toBeFocused()
  })

  test('searching from the Favourites view also returns to the weather', async ({ page }) => {
    await setup(page)
    await tab(page, /^Favourites/).click()
    await search(page, 'ber', /Berlin/)
    await expect(main(page)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Berlin' })).toBeVisible()
    expect(BERLIN.name).toBe('Berlin')
  })

  test('is operable by keyboard', async ({ page }) => {
    await setup(page)
    await tab(page, /^Favourites/).focus()
    await page.keyboard.press('Enter')
    await expect(panel(page)).toBeVisible()
    await tab(page, /^Weather/).focus()
    await page.keyboard.press('Space')
    await expect(main(page)).toBeVisible()
  })

  test('the skip link still works from the Favourites view', async ({ page }) => {
    await setup(page)
    await tab(page, /^Favourites/).click()
    await page.keyboard.press('Tab') // first stop after clicking a tab is later in the page; reset to the top
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(main(page)).toBeVisible()
  })

  test('the bar never hides content: the last line stays reachable above it', async ({ page }) => {
    await setup(page)
    await tab(page, /^Favourites/).click()
    await panel(page).getByRole('button', { name: /^Tokyo/ }).click()
    await page.getByLabel('7 degrees Celsius').waitFor()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const attribution = (await page.getByText('Weather data by Open-Meteo.com').boundingBox())!
    const bar = (await nav(page).boundingBox())!
    expect(attribution.y + attribution.height).toBeLessThanOrEqual(bar.y)
  })

  test('no horizontal overflow in either view', async ({ page }) => {
    await setup(page, [LONDON, PARIS, TOKYO, BERLIN])
    for (const view of [/^Favourites/, /^Weather/]) {
      await tab(page, view).click()
      const { sw, cw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }))
      expect(sw).toBeLessThanOrEqual(cw)
    }
  })

  for (const mode of ['light', 'dark'] as const) {
    test(`looks right in the ${mode} theme (current tab marked by bar + weight, not colour alone)`, async ({ page }) => {
      await setup(page)
      if (mode === 'dark') await page.getByRole('button', { name: /switch to dark/i }).click()
      await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /dark/ : /^(?!.*dark)/)
      await expect(page.getByLabel('7 degrees Celsius')).toHaveCount(0) // nothing selected yet: no weather
      await page.mouse.move(0, 300)
      // The current tab (Weather) is bolder than the other, so state never depends on colour alone.
      const weight = (name: RegExp) => tab(page, name).evaluate((el) => getComputedStyle(el).fontWeight)
      expect(Number(await weight(/^Weather/))).toBeGreaterThan(Number(await weight(/^Favourites/)))
      if (process.env.SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/nav-mobile-${mode}-weather.png` })
        await tab(page, /^Favourites/).click()
        await page.mouse.move(0, 300)
        await page.waitForTimeout(300)
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/nav-mobile-${mode}-favourites.png` })
      }
    })
  }
})

for (const vp of [
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`${vp.name} (${vp.width}px): persistent sidebar, no bottom bar`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('the sidebar and the weather are visible together and there is no tab bar', async ({ page }) => {
      await setup(page)
      await expect(nav(page)).toBeHidden()
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0) // out of the accessibility tree
      await expect(panel(page)).toBeVisible()
      await expect(main(page)).toBeVisible()

      const sidebar = (await panel(page).boundingBox())!
      const content = (await main(page).boundingBox())!
      expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(content.x) // side by side
      expect(Math.abs(sidebar.y - content.y)).toBeLessThan(40) // aligned at the top
    })

    test('choosing a favourite keeps keyboard focus where it was (the list stays visible)', async ({ page }) => {
      await setup(page)
      const paris = panel(page).getByRole('button', { name: /^Paris/ })
      await paris.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { level: 1, name: 'Paris' })).toBeVisible()
      await expect(paris).toBeFocused()
      await expect(paris).toHaveAttribute('aria-current', 'true')
    })

    test('the sidebar is not hidden by a leftover phone view when the window is widened', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await setup(page)
      await tab(page, /^Favourites/).click()
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await expect(main(page)).toBeVisible()
      await expect(panel(page)).toBeVisible()
      await expect(nav(page)).toBeHidden()
    })

    test('tab order: search, units and theme come before the sidebar and content', async ({ page }) => {
      await setup(page)
      const order: string[] = []
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press('Tab')
        order.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 30) ?? ''))
      }
      expect(order.slice(0, 5)).toEqual(['Skip to main content', 'WeatherBoard', '', 'Celsius (°C)', 'Fahrenheit (°F)'])
      expect(searchBox(page)).toBeDefined()
    })
  })
}
