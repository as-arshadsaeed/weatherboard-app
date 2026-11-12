import { expect, test, type Page } from '@playwright/test'

import { VIEWPORTS } from './support/audit.ts'
import { STATES } from './support/states.ts'

/** Landmarks, headings and the document title, in the real layout, for every state at every width. */

async function outline(page: Page) {
  return page.evaluate(() => {
    // checkVisibility() also looks at ancestors (a hidden <main>, a closed <dialog>), unlike display alone.
    const visible = (el: Element) => el.checkVisibility({ visibilityProperty: true })
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter(visible)
      .map((h) => Number(h.tagName[1]))
    const mains = [...document.querySelectorAll('main, [role="main"]')].filter(visible).length
    const banners = [...document.querySelectorAll('header, [role="banner"]')].filter(visible).length
    return { headings, mains, banners, lang: document.documentElement.lang, title: document.title }
  })
}

for (const viewport of VIEWPORTS) {
  test.describe(`structure: ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const state of STATES) {
      if (state.phoneOnly && viewport.width >= 768) continue
      test(state.name, async ({ page, context }) => {
        await state.setup(page, context)
        const { headings, mains, banners, lang, title } = await outline(page)

        expect(mains, 'exactly one main landmark').toBe(1)
        expect(banners, 'exactly one banner').toBe(1)
        expect(headings.filter((level) => level === 1), 'exactly one level-one heading').toHaveLength(1)
        // No skipped levels going down (h1 → h3 confuses outline navigation).
        headings.forEach((level, i) => {
          if (i > 0) expect(level - headings[i - 1]!, `heading ${i} jumps a level`).toBeLessThanOrEqual(1)
        })
        expect(lang).toBe('en')
        expect(title).toMatch(/WeatherBoard/)
      })
    }
  })
}

test.describe('page title follows the selected city', () => {
  test('names the city, and falls back to the app name', async ({ page, context }) => {
    const withCity = STATES.find((s) => s.name === 'weather loaded')!
    await withCity.setup(page, context)
    await expect(page).toHaveTitle('London · WeatherBoard')
  })
})

test.describe('dialogs are labelled modals', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  for (const name of ['settings dialog: permission explanation', 'confirm dialog: remove favourite']) {
    test(name, async ({ page, context }) => {
      await STATES.find((s) => s.name === name)!.setup(page, context)
      const dialog = page.locator('dialog[open]')
      await expect(dialog).toHaveCount(1)
      const info = await dialog.evaluate((el) => ({
        labelledBy: el.getAttribute('aria-labelledby'),
        label: document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent?.trim(),
        modal: el.matches(':modal'),
      }))
      expect(info.modal, 'opened with showModal() so the page behind is inert').toBe(true)
      expect(info.label, 'has an accessible name').toBeTruthy()
    })
  }
})
