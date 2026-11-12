import { expect, test } from '@playwright/test'

// Hits the REAL Open-Meteo API, so it is opt-in: WEATHER_LIVE=1 npm run test:e2e
test.skip(!process.env.WEATHER_LIVE, 'live API test; set WEATHER_LIVE=1 to run')

const SHOTS = process.env.SCREENSHOT_DIR

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test(`real weather renders at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/?lat=35.6762&lon=139.6503&name=Tokyo&country=Japan&region=Tokyo')
    await expect(page.getByRole('heading', { level: 1, name: 'Tokyo' })).toBeVisible()
    await expect(page.getByRole('list').getByRole('listitem')).toHaveCount(5, { timeout: 15_000 })
    await expect(page.getByText('Weather data by')).toBeVisible()

    const { sw, cw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }))
    expect(sw).toBeLessThanOrEqual(cw)
    expect(errors).toEqual([])

    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/live-${vp.name}-light.png`, fullPage: true })
      await page.getByRole('button', { name: /switch to dark/i }).click()
      await page.waitForTimeout(500)
      await page.mouse.move(0, 0)
      await page.screenshot({ path: `${SHOTS}/live-${vp.name}-dark.png`, fullPage: true })
    }
  })
}
