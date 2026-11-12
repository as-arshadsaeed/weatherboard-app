import { expect, test, type Page } from '@playwright/test'

import { GEODB_GLOB, GEOCODING_GLOB, openMeteoGeocodingBody } from './support/geocoding.ts'
import {
  asFavourite,
  BERLIN,
  LONDON,
  MADRID,
  mockApis,
  panel,
  PARIS,
  search,
  searchBox,
  seed,
  TOKYO,
} from './support/app.ts'

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::|status of 4|status of 5/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe('adding, switching and persisting', () => {
  test('save a searched city, see it listed, and have it (and the shown city) survive a reload', async ({ page }) => {
    const errors = trackErrors(page)
    const forecasts = await mockApis(page)
    await page.goto('/')

    await search(page, 'lon', /London/)
    await page.getByRole('button', { name: 'Add to favourites' }).click()
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
    await expect(panel(page).getByRole('button', { name: /^London/ })).toBeVisible()
    await expect(panel(page).getByText('1 of 5 favourites saved')).toBeVisible()

    await search(page, 'par', /Paris/)
    await page.getByRole('button', { name: 'Add to favourites' }).click()
    await expect(panel(page).getByText('2 of 5 favourites saved')).toBeVisible()

    await page.reload()
    await expect(panel(page).getByRole('listitem')).toHaveCount(2)
    await expect(page.getByRole('heading', { level: 1, name: 'Paris' })).toBeVisible() // last selected city restored
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
    expect(forecasts.length).toBeGreaterThanOrEqual(3)
    expect(errors).toEqual([])
  })

  test('choosing a favourite loads that city’s weather using its coordinates', async ({ page }) => {
    const forecasts = await mockApis(page)
    await seed(page, 'favourites', [asFavourite(LONDON), asFavourite(TOKYO)])
    await page.goto('/')
    await expect(page.getByText('No city selected')).toBeVisible()

    await panel(page).getByRole('button', { name: /^Tokyo/ }).click()
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Tokyo' })).toBeVisible()
    const url = new URL(forecasts.at(-1)!)
    expect(url.searchParams.get('latitude')).toBe('35.6895')
    expect(url.searchParams.get('longitude')).toBe('139.6917')
    await expect(panel(page).getByRole('button', { name: /^Tokyo/ })).toHaveAttribute('aria-current', 'true')
    await expect(panel(page).getByRole('button', { name: /^London/ })).not.toHaveAttribute('aria-current')
  })

  test('a sixth favourite is refused with an explanation', async ({ page }) => {
    await mockApis(page)
    await seed(page, 'favourites', [LONDON, PARIS, TOKYO, BERLIN, MADRID].map(asFavourite))
    await page.goto('/')
    await expect(panel(page).getByRole('listitem')).toHaveCount(5)

    await search(page, 'rom', /Rome/)
    await page.getByRole('button', { name: 'Add to favourites' }).click()
    await expect(page.getByText('Favourites are full (5 of 5). Remove one to save another.')).toBeVisible()
    await expect(panel(page).getByRole('listitem')).toHaveCount(5)
    await expect(panel(page).getByText('Rome')).toHaveCount(0)
  })

  test('the same city found through another provider is not saved twice', async ({ page }) => {
    await mockApis(page)
    // GeoDB is rate-limited, so search falls back to Open-Meteo geocoding, which gives London a different id.
    await page.unroute(GEODB_GLOB)
    await page.route(GEODB_GLOB, (route) => route.fulfill({ status: 429, body: '' }))
    await page.route(GEOCODING_GLOB, (route) =>
      route.fulfill({
        json: openMeteoGeocodingBody([
          { id: 2643743, name: 'London', admin1: 'England', country: 'United Kingdom', latitude: 51.50853, longitude: -0.12574, timezone: 'Europe/London' },
        ]),
      }),
    )
    await seed(page, 'favourites', [asFavourite(LONDON)]) // saved earlier as geodb:1
    await page.goto('/')

    await search(page, 'lon', /London/)
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to favourites' })).toHaveCount(0)
    await expect(panel(page).getByRole('listitem')).toHaveCount(1)
  })

  test('corrupted stored favourites fall back to an empty list without errors', async ({ page }) => {
    const errors = trackErrors(page)
    await mockApis(page)
    await seed(page, 'favourites', '{definitely not json')
    await seed(page, 'selectedCity', '"nope"')
    await page.goto('/')
    await expect(panel(page).getByText('No favourites yet')).toBeVisible()
    await expect(page.getByText('No city selected')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a partly corrupted list keeps its valid favourites', async ({ page }) => {
    await mockApis(page)
    await seed(page, 'favourites', [asFavourite(LONDON), { garbage: true }, { ...asFavourite(PARIS), latitude: 999 }, asFavourite(TOKYO)])
    await page.goto('/')
    await expect(panel(page).getByRole('listitem')).toHaveCount(2)
  })
})

test.describe('removing a favourite: the confirmation dialog in a real browser', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page)
    await seed(page, 'favourites', [asFavourite(LONDON), asFavourite(PARIS)])
    await page.goto('/')
  })

  const removeButton = (page: Page, name: string) => panel(page).getByRole('button', { name: `Remove ${name} from favourites` })

  test('opens as a labelled alertdialog with focus on the safe action', async ({ page }) => {
    await removeButton(page, 'London').click()
    const dialog = page.getByRole('alertdialog', { name: 'Remove London from favourites?' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('London (England, United Kingdom)')
    await expect(page.getByRole('button', { name: 'Keep' })).toBeFocused()
  })

  test('Escape cancels, keeps the favourite and returns focus to the button that opened it', async ({ page }) => {
    await removeButton(page, 'London').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(panel(page).getByRole('listitem')).toHaveCount(2)
    await expect(removeButton(page, 'London')).toBeFocused()
  })

  test('clicking the backdrop cancels', async ({ page }) => {
    await removeButton(page, 'London').click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(panel(page).getByRole('listitem')).toHaveCount(2)
  })

  test('is modal: focus can never land on the page behind, and the page behind is inert', async ({ page }) => {
    await removeButton(page, 'London').click()
    await expect(page.getByRole('button', { name: 'Keep' })).toBeFocused()

    // A native modal <dialog> makes everything else inert, so however we Tab, focus is either inside
    // the dialog or out in the browser UI (document.activeElement is then <body>) — never on page content.
    const focusIsSafe = () =>
      page.evaluate(() => {
        const active = document.activeElement
        return !active || active === document.body || active.closest('dialog') !== null
      })
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await focusIsSafe(), `after Tab #${i + 1}`).toBe(true)
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab')
      expect(await focusIsSafe(), `after Shift+Tab #${i + 1}`).toBe(true)
    }

    // The page behind is inert: even a scripted focus() on its controls does nothing.
    const backgroundCanTakeFocus = await page.evaluate(() => {
      const targets = [
        document.querySelector<HTMLElement>('[role="combobox"]'),
        ...document.querySelectorAll<HTMLElement>('main button, aside button'),
      ]
      return targets.some((el) => {
        el?.focus()
        return document.activeElement === el
      })
    })
    expect(backgroundCanTakeFocus).toBe(false)
  })

  test('Keep leaves everything unchanged', async ({ page }) => {
    await removeButton(page, 'Paris').click()
    await page.getByRole('button', { name: 'Keep' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(panel(page).getByRole('listitem')).toHaveCount(2)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('weatherboard:favourites')!).length)).toBe(2)
  })

  test('Remove deletes it, persists the change, and puts focus on the Favourites heading', async ({ page }) => {
    await removeButton(page, 'London').click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(panel(page).getByRole('listitem')).toHaveCount(1)
    await expect(panel(page).getByRole('button', { name: /^London/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Favourites' })).toBeFocused()

    await page.reload()
    await expect(panel(page).getByRole('listitem')).toHaveCount(1)
    await expect(panel(page).getByRole('button', { name: /^Paris/ })).toBeVisible()
  })

  test('removing from the weather card’s Saved button asks first and returns focus to it', async ({ page }) => {
    await panel(page).getByRole('button', { name: /^Paris/ }).click()
    await expect(page.getByText('7 degrees Celsius')).toBeVisible()
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(page.getByRole('alertdialog', { name: 'Remove Paris from favourites?' })).toBeVisible()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Add to favourites' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to favourites' })).toBeFocused()
    await expect(panel(page).getByRole('listitem')).toHaveCount(1)
  })
})

test.describe('when localStorage is blocked', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const deny = () => {
        throw new DOMException('blocked', 'SecurityError')
      }
      Storage.prototype.getItem = deny
      Storage.prototype.setItem = deny
      Storage.prototype.removeItem = deny
    })
    await mockApis(page)
  })

  test('shows a non-blocking notice, keeps favourites for the session, and loses them on reload', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await expect(page.getByText('Settings can’t be saved.')).toBeVisible()
    await expect(searchBox(page)).toBeEnabled() // not blocking

    await search(page, 'lon', /London/)
    await page.getByRole('button', { name: 'Add to favourites' }).click()
    await expect(panel(page).getByRole('button', { name: /^London/ })).toBeVisible()
    await page.getByRole('button', { name: 'Fahrenheit (°F)' }).click()
    await expect(page.getByText('44 degrees Fahrenheit')).toBeVisible()

    await page.reload()
    await expect(panel(page).getByText('No favourites yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Celsius (°C)' })).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
  })

  test('the notice can be dismissed', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Dismiss storage notice' }).click()
    await expect(page.getByText('Settings can’t be saved.')).toHaveCount(0)
  })

  test('no notice appears when storage works', async ({ browser }) => {
    const context = await browser.newContext() // a normal context, without the blocking script
    const page = await context.newPage()
    await mockApis(page)
    await page.goto('/')
    await expect(page.getByText('No city selected')).toBeVisible()
    await expect(page.getByText('Settings can’t be saved.')).toHaveCount(0)
    await context.close()
  })
})

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test.describe(`responsive: ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const mode of ['light', 'dark'] as const) {
      test(`full favourites flow fits in the ${mode} theme`, async ({ page }, testInfo) => {
        const errors = trackErrors(page)
        await mockApis(page)
        await seed(page, 'favourites', [LONDON, PARIS, TOKYO, BERLIN, MADRID].map(asFavourite))
        await page.goto('/')
        if (mode === 'dark') await page.getByRole('button', { name: /switch to dark/i }).click()
        await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /dark/ : /^(?!.*dark)/)

        // On phones the favourites live behind the bottom tab; from tablet up the sidebar is always visible.
        const openFavourites = async () => {
          if (vp.width < 768) await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Favourites/ }).click()
        }
        await openFavourites()
        await panel(page).getByRole('button', { name: /^Tokyo/ }).click()
        await expect(page.getByText('7 degrees Celsius')).toBeVisible() // chosen city → weather view

        const noOverflow = async () => {
          const { sw, cw } = await page.evaluate(() => ({
            sw: document.documentElement.scrollWidth,
            cw: document.documentElement.clientWidth,
          }))
          expect(sw).toBeLessThanOrEqual(cw)
        }
        await noOverflow()

        // Touch targets on the panel and the save button.
        const expectTouchTarget = async (target: ReturnType<Page['getByRole']>) => {
          await target.scrollIntoViewIfNeeded()
          const box = (await target.boundingBox())!
          expect(box.height, 'touch target height').toBeGreaterThanOrEqual(44)
          expect(box.width, 'touch target width').toBeGreaterThanOrEqual(44)
        }
        if (vp.width < 768) await expectTouchTarget(page.getByRole('button', { name: 'Saved', exact: true }))
        await openFavourites()
        if (vp.width < 768) {
          await expectTouchTarget(panel(page).getByRole('button', { name: /^Tokyo/ }))
          await expectTouchTarget(panel(page).getByRole('button', { name: 'Remove Tokyo from favourites' }))
        }

        await panel(page).getByRole('button', { name: 'Remove Tokyo from favourites' }).click()
        const dialog = page.getByRole('alertdialog')
        await expect(dialog).toBeVisible()
        const box = (await dialog.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
        if (vp.width < 768) {
          for (const name of ['Keep', 'Remove']) {
            const b = (await page.getByRole('button', { name, exact: true }).boundingBox())!
            expect(b.height).toBeGreaterThanOrEqual(44)
          }
        }
        await noOverflow()
        if (process.env.SCREENSHOT_DIR) {
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/favourites-${vp.name}-${mode}-dialog.png` })
        }
        await page.getByRole('button', { name: 'Keep' }).click()
        if (process.env.SCREENSHOT_DIR) {
          await panel(page).scrollIntoViewIfNeeded()
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/favourites-${vp.name}-${mode}-panel.png` })
        }
        expect(errors, testInfo.title).toEqual([])
      })
    }
  })
}
