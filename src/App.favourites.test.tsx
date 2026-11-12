import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { clearCitySearchCache } from '@/services/citySearch'
import { resetStorageStateForTests } from '@/services/storageService'
import { openMeteoResponse, openMeteoResult } from '@/test/fixtures/geocoding'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import { berlin, london, madrid, paris, rome, tokyo } from '@/test/cities'

const CATALOGUE: Record<string, ReturnType<typeof openMeteoResult>[]> = {
  lon: [openMeteoResult({ id: 2643743, name: 'London', latitude: 51.50853, longitude: -0.12574, admin1: 'England', country: 'United Kingdom' })],
  par: [openMeteoResult({ id: 2988507, name: 'Paris', latitude: 48.85341, longitude: 2.3488, admin1: 'Île-de-France', country: 'France' })],
  rom: [openMeteoResult({ id: 3169070, name: 'Rome', latitude: 41.89193, longitude: 12.51133, admin1: 'Lazio', country: 'Italy' })],
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetStorageStateForTests()
  clearCitySearchCache()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  fetchMock = vi.fn((url: string) => {
    const u = new URL(url)
    if (u.host === 'geocoding-api.open-meteo.com') {
      const q = (u.searchParams.get('name') ?? '').toLowerCase().slice(0, 3)
      return Promise.resolve(jsonResponse(openMeteoResponse(CATALOGUE[q])))
    }
    return Promise.resolve(jsonResponse(buildForecastResponse()))
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

const searchBox = () => screen.getByRole('combobox', { name: 'Search for a city' })
const panel = () => screen.getByRole('region', { name: 'Favourites' })
const forecastCalls = () => fetchMock.mock.calls.map((c) => new URL(String(c[0]))).filter((u) => u.host === 'api.open-meteo.com')

async function searchAndSelect(user: ReturnType<typeof userEvent.setup>, text: string, option: RegExp) {
  await user.clear(searchBox())
  await user.type(searchBox(), text)
  await user.click(await screen.findByRole('option', { name: option }))
  await screen.findByLabelText('7 degrees Celsius')
}

function preload(...cities: unknown[]) {
  window.localStorage.setItem('weatherboard:favourites', JSON.stringify(cities))
}

describe('adding favourites', () => {
  it('saves the shown city in one click and lists it in the panel', async () => {
    const user = userEvent.setup()
    render(<App />)
    await searchAndSelect(user, 'lon', /London/)

    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))
    expect(screen.getByRole('button', { name: 'Saved' })).toBeVisible()
    expect(within(panel()).getByRole('button', { name: /^London/ })).toBeVisible()
    expect(within(panel()).getByLabelText('1 of 5 favourites saved')).toBeVisible()
    expect(JSON.parse(window.localStorage.getItem('weatherboard:favourites')!)).toHaveLength(1)
  })

  it('recognises an already-saved city found through a different provider (no duplicate)', async () => {
    const user = userEvent.setup()
    preload(london) // saved earlier from GeoDB (id geodb:1)
    render(<App />)
    await searchAndSelect(user, 'lon', /London/) // now arrives as open-meteo:2643743

    expect(screen.getByRole('button', { name: 'Saved' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add to favourites' })).toBeNull()
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(1)
  })

  it('refuses a sixth favourite with an explanation and keeps the five', async () => {
    const user = userEvent.setup()
    preload(london, paris, tokyo, berlin, madrid)
    render(<App />)
    await searchAndSelect(user, 'rom', /Rome/)

    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))
    expect(screen.getByText('Favourites are full (5 of 5). Remove one to save another.')).toBeVisible()
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(5)
    expect(within(panel()).queryByText('Rome')).toBeNull()
    expect(rome).toBeDefined()
  })
})

describe('switching to a favourite', () => {
  it('loads that city’s weather using its coordinates and highlights it', async () => {
    const user = userEvent.setup()
    preload(london, paris)
    render(<App />)
    expect(screen.getByText('No city selected')).toBeVisible()

    await user.click(within(panel()).getByRole('button', { name: /^Paris/ }))
    expect(await screen.findByLabelText('7 degrees Celsius')).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'Paris' })).toBeVisible()
    expect(forecastCalls().at(-1)?.searchParams.get('latitude')).toBe('48.8534')
    expect(forecastCalls().at(-1)?.searchParams.get('longitude')).toBe('2.3488')
    expect(within(panel()).getByRole('button', { name: /^Paris/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Saved' })).toBeVisible()
  })

  it('moves between favourites', async () => {
    const user = userEvent.setup()
    preload(london, paris)
    render(<App />)
    await user.click(within(panel()).getByRole('button', { name: /^Paris/ }))
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(within(panel()).getByRole('button', { name: /^London/ }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'London' })).toBeVisible())
    expect(within(panel()).getByRole('button', { name: /^London/ })).toHaveAttribute('aria-current', 'true')
  })
})

describe('removing favourites (always confirmed)', () => {
  it('Keep cancels: the favourite stays', async () => {
    const user = userEvent.setup()
    preload(london)
    render(<App />)
    await user.click(within(panel()).getByRole('button', { name: 'Remove London from favourites' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Remove London from favourites?' })
    expect(dialog).toHaveTextContent('London (England, United Kingdom)')
    await user.click(within(dialog).getByRole('button', { name: 'Keep' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(within(panel()).getByRole('button', { name: /^London/ })).toBeVisible()
    expect(JSON.parse(window.localStorage.getItem('weatherboard:favourites')!)).toHaveLength(1)
  })

  it('Remove confirms: the favourite is deleted and focus lands somewhere sensible', async () => {
    const user = userEvent.setup()
    preload(london, paris)
    render(<App />)
    await user.click(within(panel()).getByRole('button', { name: 'Remove London from favourites' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(within(panel()).queryByRole('button', { name: /^London/ })).toBeNull()
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(1)
    expect(JSON.parse(window.localStorage.getItem('weatherboard:favourites')!).map((c: { name: string }) => c.name)).toEqual(['Paris'])
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Favourites' })).toHaveFocus())
  })

  it('the Saved button on the weather card also asks first, then returns to "Add to favourites"', async () => {
    const user = userEvent.setup()
    render(<App />)
    await searchAndSelect(user, 'lon', /London/)
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))

    await user.click(screen.getByRole('button', { name: 'Saved' }))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Saved' })).toBeVisible() // not removed yet

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('button', { name: 'Add to favourites' })).toBeVisible()
    expect(within(panel()).getByText('No favourites yet')).toBeVisible()
  })

  it('keeps showing the removed city’s weather (only the favourite goes away)', async () => {
    const user = userEvent.setup()
    preload(london)
    render(<App />)
    await user.click(within(panel()).getByRole('button', { name: /^London/ }))
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(within(panel()).getByRole('button', { name: 'Remove London from favourites' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
  })
})

describe('persistence across reloads', () => {
  it('restores favourites and the last selected city (and fetches its weather)', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await searchAndSelect(user, 'lon', /London/)
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))
    await searchAndSelect(user, 'par', /Paris/)
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))
    first.unmount()

    render(<App />) // "reload"
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(2)
    expect(await screen.findByLabelText('7 degrees Celsius')).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'Paris' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Saved' })).toBeVisible()
  })

  it('shows a clean empty state when the stored favourites are corrupted', () => {
    window.localStorage.setItem('weatherboard:favourites', '{definitely not json')
    render(<App />)
    expect(within(panel()).getByText('No favourites yet')).toBeVisible()
    expect(screen.queryByRole('status', { name: /./ })).toBeNull()
  })

  it('keeps the valid favourites when only some stored entries are corrupted', () => {
    preload(london, { garbage: true }, { ...paris, longitude: 9999 }, tokyo)
    render(<App />)
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('when localStorage is unavailable', () => {
  function blockStorage() {
    const deny = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(deny)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(deny)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(deny)
  }

  it('warns, non-blockingly, that preferences will not persist', async () => {
    blockStorage()
    render(<App />)
    expect(await screen.findByText('Settings can’t be saved.')).toBeVisible()
    expect(screen.getByText(/lost when you close this tab/)).toBeVisible()
    // Non-blocking: the whole app is still usable.
    expect(searchBox()).toBeEnabled()
  })

  it('favourites still work for the session but are gone after a reload', async () => {
    blockStorage()
    const user = userEvent.setup()
    const first = render(<App />)
    await searchAndSelect(user, 'lon', /London/)
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }))
    expect(within(panel()).getByRole('button', { name: /^London/ })).toBeVisible()
    first.unmount()

    resetStorageStateForTests()
    render(<App />)
    expect(within(panel()).getByText('No favourites yet')).toBeVisible()
  })

  it('shows no notice when storage works', () => {
    render(<App />)
    expect(screen.queryByText('Settings can’t be saved.')).toBeNull()
  })
})
