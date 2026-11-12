import { expect, test } from '@playwright/test'

import { STATES } from './support/states.ts'

const state = (name: string) => STATES.find((s) => s.name === name)!

/** Landscape phones and other short windows: fixed bars must not eat the screen, dialogs must scroll. */
test.describe('landscape phone (667 × 375)', () => {
  test.use({ viewport: { width: 667, height: 375 } })

  test('the header scrolls away instead of staying pinned', async ({ page, context }) => {
    await state('weather loaded').setup(page, context)
    expect(await page.locator('header').evaluate((el) => getComputedStyle(el).position)).toBe('static')
    await page.mouse.wheel(0, 600)
    await expect.poll(() => page.locator('header').evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThan(0)
  })

  test('the page has no horizontal overflow and the tab bar stays reachable', async ({ page, context }) => {
    await state('weather loaded').setup(page, context)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' })).toBeInViewport()
  })

  for (const name of ['settings dialog: permission explanation', 'confirm dialog: remove favourite']) {
    test(`${name} fits the viewport`, async ({ page, context }) => {
      await state(name).setup(page, context)
      const box = (await page.locator('dialog[open]').boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(375)
    })
  }
})

test.describe('very short window (320 × 240)', () => {
  test.use({ viewport: { width: 320, height: 240 } })

  test('the settings dialog scrolls inside itself and its last control can be reached', async ({ page, context }) => {
    await state('settings dialog: permission explanation').setup(page, context)
    const dialog = page.locator('dialog[open]')
    const { scrollable, fits } = await dialog.evaluate((el) => ({
      scrollable: el.scrollHeight > el.clientHeight,
      fits: el.getBoundingClientRect().height <= innerHeight,
    }))
    expect(fits).toBe(true)
    expect(scrollable).toBe(true)

    const last = dialog.getByRole('button', { name: 'Send a test reminder' })
    await last.focus()
    const visible = await last.evaluate((el) => {
      const d = el.closest('dialog')!.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      // The 2px ring plus its 2px offset must also be inside the dialog's visible box.
      return r.top - 4 >= d.top - 0.5 && r.bottom + 4 <= d.bottom + 0.5
    })
    expect(visible).toBe(true)
  })
})

test.describe('page scroll lock while a dialog is open', () => {
  test.use({ viewport: { width: 375, height: 500 } })

  test('the page behind a modal does not scroll, and scrolls again once it closes', async ({ page, context }) => {
    await state('weather loaded').setup(page, context)
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true)

    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden')
    await page.mouse.move(5, 5) // over the backdrop, outside the dialog
    await page.mouse.wheel(0, 400)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await page.getByRole('button', { name: 'Close settings' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden')
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  })
})
