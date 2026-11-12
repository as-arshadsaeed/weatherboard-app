import { expect, type Page } from '@playwright/test'

import { geoDbBody, geoDbCity, GEODB_GLOB } from './geocoding.ts'
import { API_GLOB, forecastBody } from './openMeteo.ts'

/** TEST-ONLY shared setup for the app-level specs (cities, network interception, seeding storage). */

export const LONDON = geoDbCity(1, 'London', 'England', 'United Kingdom', 51.5085, -0.1257)
export const PARIS = geoDbCity(2, 'Paris', 'Île-de-France', 'France', 48.8534, 2.3488)
export const TOKYO = geoDbCity(3, 'Tokyo', 'Tokyo', 'Japan', 35.6895, 139.6917)
export const BERLIN = geoDbCity(4, 'Berlin', 'Berlin', 'Germany', 52.52, 13.405)
export const MADRID = geoDbCity(5, 'Madrid', 'Madrid', 'Spain', 40.4168, -3.7038)
export const ROME = geoDbCity(6, 'Rome', 'Lazio', 'Italy', 41.9028, 12.4964)
const BY_PREFIX: Record<string, unknown> = { lon: LONDON, par: PARIS, tok: TOKYO, ber: BERLIN, mad: MADRID, rom: ROME }

export const asFavourite = (c: ReturnType<typeof geoDbCity>) => ({
  id: `geodb:${c.id}`,
  name: c.name,
  region: c.region,
  country: c.country,
  latitude: c.latitude,
  longitude: c.longitude,
})

export const searchBox = (page: Page) => page.getByRole('combobox', { name: 'Search for a city' })
export const panel = (page: Page) => page.getByRole('region', { name: 'Favourites' })

/** Intercept the forecast and GeoDB (one city per 3-letter prefix); returns the forecast URLs requested. */
export async function mockApis(page: Page) {
  const forecasts: string[] = []
  await page.route(API_GLOB, (route) => {
    forecasts.push(route.request().url())
    return route.fulfill({ json: forecastBody() })
  })
  await page.route(GEODB_GLOB, (route) => {
    const prefix = (new URL(route.request().url()).searchParams.get('namePrefix') ?? '').toLowerCase().slice(0, 3)
    const hit = BY_PREFIX[prefix]
    return route.fulfill({ json: geoDbBody(hit ? [hit] : []) })
  })
  return forecasts
}

/** Seed localStorage once (never overwriting what the app has saved since, e.g. across reloads). */
export async function seed(page: Page, key: string, value: unknown) {
  await page.addInitScript(
    ([k, v]) => {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, v)
    },
    [`weatherboard:${key}`, typeof value === 'string' ? value : JSON.stringify(value)] as const,
  )
}

export async function search(page: Page, text: string, optionName: RegExp) {
  await searchBox(page).fill(text)
  await page.getByRole('option', { name: optionName }).click()
  await expect(page.getByText('7 degrees Celsius')).toBeVisible()
}

