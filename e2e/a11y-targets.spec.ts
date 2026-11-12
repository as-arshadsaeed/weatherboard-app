import { expect, test } from '@playwright/test'

import { findSmallTargets, MIN_TARGET_PX } from './support/audit.ts'
import { STATES } from './support/states.ts'

/** Spec §7: touch targets are at least 44 × 44 CSS px on phones. */
test.describe('touch targets at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  for (const state of STATES) {
    test(state.name, async ({ page, context }) => {
      await state.setup(page, context)
      await page.mouse.move(0, 0)
      expect(await findSmallTargets(page)).toEqual([])
    })
  }

  test('the skip link is a full-size target when it appears', async ({ page, context }) => {
    await STATES.find((s) => s.name === 'weather loaded')!.setup(page, context)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Tab')
    const link = page.getByRole('link', { name: 'Skip to main content' })
    await expect(link).toBeFocused()
    const box = (await link.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET_PX - 0.5)
    expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })
})
