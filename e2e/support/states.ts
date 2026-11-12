import { expect, type BrowserContext, type Page } from '@playwright/test'

import { asFavourite, BERLIN, LONDON, MADRID, mockApis, PARIS, seed, TOKYO } from './app.ts'
import { GEODB_GLOB, GEOCODING_GLOB } from './geocoding.ts'
import { API_GLOB } from './openMeteo.ts'
import { waitForServiceWorkerControl } from './serviceWorker.ts'

/**
 * TEST-ONLY library of reachable app states for the responsive / accessibility audit. Each state is
 * set up through the real UI with network responses intercepted, so what is audited is what users see.
 */
export const LONDON_URL = '/?lat=51.5085&lon=-0.1257&name=London&country=United%20Kingdom&region=England'

export interface AppState {
  name: string
  /** Only meaningful on phones (e.g. the bottom-bar Favourites view). */
  phoneOnly?: boolean
  setup: (page: Page, context: BrowserContext) => Promise<void>
}

const isPhone = (page: Page) => page.viewportSize()!.width < 768

export async function openSettings(page: Page) {
  const entry = isPhone(page)
    ? page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' })
    : page.getByRole('banner').getByRole('button', { name: 'Settings' })
  await entry.click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
}

async function weatherShown(page: Page) {
  await expect(page.getByText(/degrees (Celsius|Fahrenheit)/)).toBeVisible()
}

async function savedSnapshotExists(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const dbs = await indexedDB.databases()
        if (!dbs.some((d) => d.name === 'weatherboard')) return 0
        return new Promise<number>((resolve) => {
          const open = indexedDB.open('weatherboard')
          open.onsuccess = () => {
            const db = open.result
            const count = db.transaction('weather-snapshots').objectStore('weather-snapshots').count()
            count.onsuccess = () => {
              db.close()
              resolve(count.result)
            }
          }
        })
      }),
    )
    .toBeGreaterThan(0)
}

export const STATES: AppState[] = [
  {
    name: 'empty: no city selected',
    setup: async (page) => {
      await mockApis(page)
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'No city selected' })).toBeVisible()
    },
  },
  {
    name: 'weather loaded',
    setup: async (page) => {
      await mockApis(page)
      await page.goto(LONDON_URL)
      await weatherShown(page)
    },
  },
  {
    name: 'weather loading (skeleton)',
    setup: async (page) => {
      await mockApis(page)
      await page.route(API_GLOB, () => new Promise(() => {})) // never answers
      await page.goto(LONDON_URL)
      await expect(page.getByRole('status').filter({ hasText: 'Loading weather' })).toBeVisible()
    },
  },
  {
    name: 'weather error (service outage)',
    setup: async (page) => {
      await mockApis(page)
      await page.route(API_GLOB, (route) => route.fulfill({ status: 503, body: '' }))
      await page.goto(LONDON_URL)
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'location rejected (invalid coordinates)',
    setup: async (page) => {
      await mockApis(page)
      await page.goto('/?lat=999&lon=0&name=Nowhere')
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'offline: saved weather + banners',
    setup: async (page, context) => {
      await mockApis(page)
      await page.goto(LONDON_URL)
      await weatherShown(page)
      await savedSnapshotExists(page)
      await waitForServiceWorkerControl(page)
      await context.setOffline(true)
      await page.reload()
      await expect(page.getByRole('status', { name: 'Saved weather' })).toBeVisible()
    },
  },
  {
    name: 'service unreachable: saved weather + retry',
    setup: async (page) => {
      await mockApis(page)
      await page.goto(LONDON_URL)
      await weatherShown(page)
      await savedSnapshotExists(page)
      await page.unroute(API_GLOB)
      await page.route(API_GLOB, (route) => route.abort('failed'))
      await page.reload()
      await expect(page.getByRole('status', { name: 'Saved weather' })).toBeVisible()
    },
  },
  {
    name: 'favourites: five saved, one selected',
    setup: async (page) => {
      await seed(page, 'favourites', [LONDON, PARIS, TOKYO, BERLIN, MADRID].map(asFavourite))
      await mockApis(page)
      await page.goto(LONDON_URL)
      await weatherShown(page)
    },
  },
  {
    name: 'phone: favourites view',
    phoneOnly: true,
    setup: async (page) => {
      await seed(page, 'favourites', [LONDON, PARIS, TOKYO].map(asFavourite))
      await mockApis(page)
      await page.goto('/')
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Favourites/ }).click()
      await expect(page.getByRole('region', { name: 'Favourites' })).toBeVisible()
    },
  },
  {
    name: 'search: suggestions open',
    setup: async (page) => {
      await mockApis(page)
      await page.goto('/')
      await page.getByRole('combobox', { name: 'Search for a city' }).fill('lon')
      await expect(page.getByRole('listbox')).toBeVisible()
    },
  },
  {
    name: 'search: no results',
    setup: async (page) => {
      await mockApis(page)
      await page.goto('/')
      await page.getByRole('combobox', { name: 'Search for a city' }).fill('zzqx')
      await expect(page.getByText('No cities found. Try another spelling or search by country.').first()).toBeVisible()
    },
  },
  {
    name: 'search: error',
    setup: async (page) => {
      await mockApis(page)
      await page.route(GEODB_GLOB, (route) => route.abort('failed'))
      await page.route(GEOCODING_GLOB, (route) => route.abort('failed'))
      await page.goto('/')
      await page.getByRole('combobox', { name: 'Search for a city' }).fill('lon')
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    },
  },
  {
    name: 'search: validation message on blur',
    setup: async (page) => {
      await mockApis(page)
      await page.goto('/')
      await page.getByRole('combobox', { name: 'Search for a city' }).focus()
      await page.keyboard.press('Tab')
      await expect(page.getByText('Enter a city name to search.')).toBeVisible()
    },
  },
  {
    name: 'settings dialog: permission explanation',
    setup: async (page) => {
      await page.addInitScript(() => {
        class FakeNotification {
          static permission = 'default'
          static requestPermission() {
            return Promise.resolve('default')
          }
        }
        ;(window as unknown as Record<string, unknown>).Notification = FakeNotification
      })
      await mockApis(page)
      await page.goto(LONDON_URL)
      await weatherShown(page)
      await openSettings(page)
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('switch').click()
      await expect(page.getByRole('button', { name: 'Allow notifications' })).toBeVisible()
    },
  },
  {
    name: 'settings dialog: time validation error',
    setup: async (page) => {
      await mockApis(page)
      await page.goto('/')
      await openSettings(page)
      await page.getByRole('dialog', { name: 'Settings' }).getByLabel('Reminder time').fill('15:00')
      await expect(page.getByRole('alert').filter({ hasText: 'morning time' })).toBeVisible()
    },
  },
  {
    name: 'confirm dialog: remove favourite',
    setup: async (page) => {
      await seed(page, 'favourites', [LONDON, PARIS].map(asFavourite))
      await mockApis(page)
      await page.goto('/')
      if (isPhone(page)) await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Favourites/ }).click()
      await page.getByRole('button', { name: 'Remove London from favourites' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'notices: storage blocked + test reminder',
    setup: async (page) => {
      await page.addInitScript(() => {
        const deny = () => {
          throw new DOMException('blocked', 'SecurityError')
        }
        Storage.prototype.getItem = deny
        Storage.prototype.setItem = deny
        Storage.prototype.removeItem = deny
      })
      await mockApis(page)
      await page.goto(LONDON_URL)
      await weatherShown(page)
      await openSettings(page)
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Send a test reminder' }).click()
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close settings' }).click()
      await expect(page.getByRole('status', { name: 'Test reminder' })).toBeVisible()
      await expect(page.getByText('Settings can’t be saved.')).toBeVisible()
    },
  },
  {
    name: 'notices: offline-ready after first install',
    setup: async (page) => {
      await mockApis(page)
      await page.goto('/')
      await expect(page.getByText('can now open without a connection')).toBeVisible({ timeout: 15_000 })
    },
  },
]
