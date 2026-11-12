import { expect, test } from '@playwright/test'

import { STATES } from './support/states.ts'

/** prefers-reduced-motion (WCAG 2.3.3): nothing keeps moving and nothing animates for longer than a blink. */
const BLINK_SECONDS = 0.011

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

  for (const state of STATES.filter((s) => !s.phoneOnly)) {
    test(state.name, async ({ page, context }) => {
      await state.setup(page, context)
      const moving = await page.evaluate((limit) => {
        const seconds = (value: string) =>
          Math.max(0, ...value.split(',').map((v) => (v.trim().endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v) || 0)))
        const offenders: string[] = []
        for (const el of document.querySelectorAll<HTMLElement>('*')) {
          const s = getComputedStyle(el)
          const animation = s.animationName !== 'none' ? seconds(s.animationDuration) : 0
          if (animation > limit || seconds(s.transitionDuration) > limit) {
            offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`)
          }
        }
        return offenders
      }, BLINK_SECONDS)
      expect(moving).toEqual([])
    })
  }

  test('smooth scrolling is off', async ({ page }) => {
    await page.goto('/')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).not.toBe('smooth')
  })
})

test.describe('motion is allowed by default', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' })

  test('the weather icons animate, which is what the reduced-motion tests switch off', async ({ page, context }) => {
    await STATES.find((s) => s.name === 'weather loaded')!.setup(page, context)
    await expect(page.locator('main [data-weather-icon]:visible .lottie-icon svg')).toHaveCount(6)
  })
})

test.describe('reduced motion and the weather icons', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

  test('no animation is drawn, so none can keep moving', async ({ page, context }) => {
    await STATES.find((s) => s.name === 'weather loaded')!.setup(page, context)
    await expect(page.locator('main [data-weather-icon]:visible svg.lucide')).toHaveCount(6)
    await expect(page.locator('.lottie-icon')).toHaveCount(0)
  })
})
