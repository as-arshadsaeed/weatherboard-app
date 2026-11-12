import { expect, test } from '@playwright/test'

import { API_GLOB, forecastBody, LONDON_URL } from './support/openMeteo.ts'

/**
 * From the xl breakpoint the header's logo column must be exactly as wide as the sidebar below it (18 rem), so
 * the search box lines up with the weather column. The logo's width is calc(18.5rem - 0.5rem): the 0.5 rem
 * is the logo's own allowance, which is why it is not written as 18rem.
 */
const SIDEBAR_XL_PX = 18 * 16

for (const width of [1280, 1440, 1920]) {
  test(`the logo column matches the sidebar and the search lines up with the weather column at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route(API_GLOB, (route) => route.fulfill({ json: forecastBody() }))
    await page.goto(LONDON_URL)
    await expect(page.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()

    const box = (selector: string) =>
      page.locator(selector).first().evaluate((el) => {
        const { left, width } = el.getBoundingClientRect()
        return { left, width }
      })
    const logo = await box('header a[href="/"]')
    const sidebar = await box('aside')
    const search = await box('header [role="combobox"] >> xpath=ancestor::div[1]')
    const main = await box('main')

    expect(sidebar.width).toBe(SIDEBAR_XL_PX)
    expect(logo.width).toBe(SIDEBAR_XL_PX)
    expect(logo.left).toBe(sidebar.left)
    expect(search.left).toBe(main.left)
  })
}
