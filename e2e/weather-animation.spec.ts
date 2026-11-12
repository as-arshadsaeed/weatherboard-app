import { expect, test, type Page } from '@playwright/test'

import { API_GLOB, forecastBody, LONDON_URL } from './support/openMeteo.ts'

/**
 * Animated weather icons (Lottie). Service workers are blocked so that page.route can see, and fail, the
 * chunk requests; offline use of the same chunks is covered by the precache test in pwa.spec.ts.
 */
test.use({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } })

// The current conditions plus five forecast days. (The weather card renders a second, hidden copy for the
// other breakpoint, so only visible icons are counted.)
const ICONS = 'main [data-weather-icon]:visible'
const DRAWN = `${ICONS} .lottie-icon svg`
const EXPECTED_ICONS = 6

async function open(page: Page) {
  await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
  await page.goto(LONDON_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
}

test.describe('rendering', () => {
  test('current weather and every forecast day get an animated icon', async ({ page }) => {
    await open(page)
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)
    // The static glyph is replaced, not shown twice.
    await expect(page.locator(`${ICONS} svg.lucide:visible`)).toHaveCount(0)
  })

  test('the animation is actually moving', async ({ page }) => {
    await open(page)
    const svg = page.locator(DRAWN).first()
    await expect(svg).toBeVisible()
    const snapshot = () => svg.evaluate((el) => el.innerHTML)
    const first = await snapshot()
    await expect.poll(snapshot, { timeout: 5000 }).not.toBe(first)
  })

  test('icons keep the same size and place as the animation loads (no layout shift)', async ({ page }) => {
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.goto(LONDON_URL)
    const tiles = page.locator(ICONS)
    await expect(tiles).toHaveCount(EXPECTED_ICONS)
    const boxes = () => tiles.evaluateAll((els) => els.map((el) => JSON.stringify(el.getBoundingClientRect().toJSON())))
    const staticPhase = await boxes()
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)
    expect(await boxes()).toEqual(staticPhase)
  })

  test('the drawing fits inside its tile', async ({ page }) => {
    await open(page)
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)
    const overflow = await page.locator(ICONS).evaluateAll((tiles) =>
      tiles.filter((tile) => {
        const t = tile.getBoundingClientRect()
        const s = tile.querySelector('.lottie-icon')!.getBoundingClientRect()
        return s.left < t.left - 0.5 || s.right > t.right + 0.5 || s.top < t.top - 0.5 || s.bottom > t.bottom + 0.5
      }).length,
    )
    expect(overflow).toBe(0)
  })
})

for (const scheme of ['light', 'dark'] as const) {
  test(`colours come from the ${scheme} theme's design tokens`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await open(page)
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)

    const mismatches = await page.evaluate(() => {
      const resolve = (token: string) => {
        const probe = document.createElement('span')
        probe.style.color = `var(--weather-${token})`
        document.body.appendChild(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }
      const bad: string[] = []
      let checked = 0
      for (const token of ['sun', 'cloud', 'rain', 'snow', 'storm', 'night']) {
        const expected = resolve(token)
        for (const path of document.querySelectorAll(`.lottie-icon .wb-${token} path`)) {
          checked++
          if (getComputedStyle(path).fill !== expected) bad.push(`${token}: ${getComputedStyle(path).fill} != ${expected}`)
        }
      }
      return { bad, checked }
    })
    expect(mismatches.checked).toBeGreaterThan(0)
    expect(mismatches.bad).toEqual([])
  })
}

test('the light and dark palettes differ, so the icons are not one fixed colour', async ({ page }) => {
  const fillOf = async (scheme: 'light' | 'dark') => {
    await page.emulateMedia({ colorScheme: scheme })
    await open(page)
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)
    return page.locator('.lottie-icon path').first().evaluate((el) => getComputedStyle(el).fill)
  }
  const light = await fillOf('light')
  await page.unroute(API_GLOB)
  const dark = await fillOf('dark')
  expect(light).not.toBe(dark)
})

test.describe('accessibility', () => {
  test('decorative: hidden from assistive technology, with the condition stated in text', async ({ page }) => {
    await open(page)
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)
    expect(
      await page.locator(ICONS).evaluateAll((tiles) => tiles.every((t) => t.getAttribute('aria-hidden') === 'true')),
    ).toBe(true)
    await expect(page.getByRole('img')).toHaveCount(0)
    await expect(page.getByText('Partly cloudy', { exact: true })).toBeVisible() // the text alternative
  })

  test('the animation takes no part in keyboard navigation', async ({ page }) => {
    await open(page)
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)
    expect(await page.locator('.lottie-icon svg[focusable="true"], .lottie-icon [tabindex]').count()).toBe(0)
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('shows static icons and never downloads the player or any animation', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => requested.push(request.url()))
    await open(page)
    await expect(page.locator(`${ICONS} svg.lucide:visible`)).toHaveCount(EXPECTED_ICONS)
    await page.waitForTimeout(500)
    await expect(page.locator('.lottie-icon')).toHaveCount(0)
    expect(requested.filter((url) => /lottie_light|\/assets\/(sun|moon|cloud|cloud-sun|cloud-moon|fog|drizzle|rain|heavy-rain|snow|snowflake|thunderstorm|hail)-[\w-]+\.js/.test(url))).toEqual([])
  })

  test('switching the preference on while the app is open stops the animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await open(page)
    await expect(page.locator(DRAWN)).toHaveCount(EXPECTED_ICONS)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.locator('.lottie-icon')).toHaveCount(0)
    await expect(page.locator(`${ICONS} svg.lucide:visible`)).toHaveCount(EXPECTED_ICONS)
  })
})

test.describe('when the animation cannot be loaded', () => {
  const consoleProblems = (page: Page) => {
    const problems: string[] = []
    page.on('pageerror', (error) => problems.push(error.message))
    return problems
  }

  test('a missing player leaves the static icons in place', async ({ page }) => {
    const problems = consoleProblems(page)
    await page.route('**/assets/lottie_light-*.js', (route) => route.abort())
    await open(page)
    await expect(page.locator(`${ICONS} svg.lucide:visible`)).toHaveCount(EXPECTED_ICONS)
    await page.waitForTimeout(500)
    await expect(page.locator(`${ICONS} svg.lucide:visible`)).toHaveCount(EXPECTED_ICONS)
    await expect(page.locator('.lottie-icon svg')).toHaveCount(0)
    expect(problems).toEqual([])
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible() // dashboard unaffected
  })

  test('one missing animation leaves only that icon static', async ({ page }) => {
    const problems = consoleProblems(page)
    // Every animation file except the drizzle/rain ones the test data does not use is irrelevant; break all.
    await page.route(/\/assets\/(sun|moon|cloud|cloud-sun|cloud-moon|fog|drizzle|rain|heavy-rain|snow|snowflake|thunderstorm|hail)-[\w-]+\.js/, (route) => route.abort())
    await open(page)
    await expect(page.locator(`${ICONS} svg.lucide:visible`)).toHaveCount(EXPECTED_ICONS)
    expect(problems).toEqual([])
  })

  test('a corrupt animation file falls back instead of breaking the page', async ({ page }) => {
    const problems = consoleProblems(page)
    await page.route(/\/assets\/(sun|moon|cloud|cloud-sun|cloud-moon|fog|drizzle|rain|heavy-rain|snow|snowflake|thunderstorm|hail)-[\w-]+\.js/, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: 'export default { not: "an animation" }' }),
    )
    await open(page)
    await expect(page.locator(`${ICONS} svg.lucide:visible`)).toHaveCount(EXPECTED_ICONS)
    expect(problems).toEqual([])
  })
})
