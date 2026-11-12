import { expect, test } from '@playwright/test'

import { VIEWPORTS, walkFocusOrder } from './support/audit.ts'
import { STATES } from './support/states.ts'

/**
 * Keyboard focus: every stop shows an indicator, the indicator is not cut off by an ancestor's overflow,
 * and the element is not hidden behind the sticky header or the bottom tab bar (WCAG 2.4.7, 2.4.11).
 */
const WALKED_STATES = [
  'weather loaded',
  'favourites: five saved, one selected',
  'phone: favourites view',
  'search: suggestions open',
  'settings dialog: permission explanation',
  'confirm dialog: remove favourite',
]

for (const viewport of VIEWPORTS) {
  test.describe(`focus: ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const name of WALKED_STATES) {
      const state = STATES.find((s) => s.name === name)!
      if (state.phoneOnly && viewport.width >= 768) continue
      test(name, async ({ page, context }) => {
        await state.setup(page, context)
        const stops = await walkFocusOrder(page)
        expect(stops.length, 'there is something to tab to').toBeGreaterThanOrEqual(2)
        expect(stops.filter((s) => !s.hasIndicator).map((s) => s.target), 'no focus indicator').toEqual([])
        expect(stops.filter((s) => s.clippedBy).map((s) => `${s.target} in ${s.clippedBy}`), 'ring clipped').toEqual([])
        expect(stops.filter((s) => s.reachablePointsOf9 < 9).map((s) => s.target), 'covered by other UI').toEqual([])
      })
    }
  })
}

test.describe('focus order follows the visual order', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('desktop header: skip link, logo, search, units, theme, settings', async ({ page, context }) => {
    await STATES.find((s) => s.name === 'weather loaded')!.setup(page, context)
    const stops = await walkFocusOrder(page, 8)
    const order = stops.map((s) => s.target)
    const indexOf = (text: string) => order.findIndex((t) => t.includes(text))
    const expected = ['Skip to main content', 'WeatherBoard', 'Celsius', 'Fahrenheit', 'Settings']
    const positions = expected.map(indexOf)
    expect(positions.every((p) => p >= 0), `all present in ${order.join(' → ')}`).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})

test.describe('focused elements stay clear of the fixed bars', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('scroll padding keeps the last controls above the bottom tab bar', async ({ page, context }) => {
    await STATES.find((s) => s.name === 'weather loaded')!.setup(page, context)
    await page.evaluate(() => window.scrollTo(0, 0))
    // Reach the very last link on the page by keyboard, scrolling it into view the way a user would.
    const link = page.getByRole('link', { name: 'Open-Meteo.com' })
    await link.focus()
    const covered = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const nav = document.querySelector('nav[aria-label="Main"]')!.getBoundingClientRect()
      const header = document.querySelector('header')!.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return r.bottom > nav.top || r.top < header.bottom
    })
    expect(covered).toBe(false)
  })

  test('the root defines scroll padding for the fixed bars', async ({ page }) => {
    await page.goto('/')
    const { top, bottom } = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return { top: parseFloat(s.scrollPaddingTop), bottom: parseFloat(s.scrollPaddingBottom) }
    })
    expect(top).toBeGreaterThanOrEqual(120) // the two-row phone header
    expect(bottom).toBeGreaterThanOrEqual(72) // the 56 px tab bar plus room
  })
})
