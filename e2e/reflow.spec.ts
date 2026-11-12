import { expect, test, type Page } from '@playwright/test'

import { API_GLOB, forecastBody } from './support/openMeteo.ts'

/**
 * Reflow (WCAG 1.4.10), text resize (1.4.4) and long content. The page clips horizontal overflow
 * (`overflow-x: clip`), so `scrollWidth` cannot reveal content that is cut off: these checks look at where
 * every visible element actually sits instead.
 */
const LONG_NAME = 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch'
const LONG_URL = `/?lat=53.2214&lon=-4.2022&name=${LONG_NAME}&country=${encodeURIComponent(
  'The United Kingdom of Great Britain and Northern Ireland',
)}&region=${encodeURIComponent('Isle of Anglesey')}`

/** Elements that extend past the viewport's left or right edge (ignoring visually hidden ones). */
async function elementsOutsideViewport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const offenders: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (el.closest('[aria-hidden="true"][class*="animate-"], .sr-only, dialog:not([open])')) continue
      if (el.classList.contains('sr-only')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.left < -0.5 || rect.right > width + 0.5) {
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(rect.left)}–${Math.round(rect.right)}]`)
      }
    }
    return offenders
  })
}

for (const width of [320, 375, 768, 1280]) {
  test(`a very long city name stays inside the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.goto(LONG_URL)

    const heading = page.getByRole('heading', { level: 1, name: LONG_NAME })
    await expect(heading).toBeVisible()
    // Wrapped, not truncated: the whole name must be laid out within the heading's box.
    const fits = await heading.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(fits).toBe(true)

    expect(await elementsOutsideViewport(page)).toEqual([])
  })
}

test('content reflows at 320px with text enlarged to 200%', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
  await page.goto(LONG_URL)
  await expect(page.getByRole('heading', { level: 1, name: LONG_NAME })).toBeVisible()

  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  expect(await elementsOutsideViewport(page)).toEqual([])
})
