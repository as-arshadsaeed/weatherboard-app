import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { openMeteoResponse, openMeteoResult } from '@/test/fixtures/geocoding'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import { clearCitySearchCache } from '@/services/citySearch'
import { resetStorageStateForTests } from '@/services/storageService'

beforeEach(() => {
  resetStorageStateForTests()
  clearCitySearchCache()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('dashboard shell', () => {
  it('exposes the expected landmarks and a skip link', () => {
    render(<App />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Saved cities' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    )
  })

  it('shows an honest empty state with no weather values', () => {
    render(<App />)
    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'No city selected' })).toBeVisible()
    expect(main.textContent).not.toMatch(/\d\s*°/)
  })

  it('shows the favourites empty state with the 5-city limit', () => {
    render(<App />)
    const panel = screen.getByRole('region', { name: 'Favourites' })
    expect(within(panel).getByText('No favourites yet')).toBeVisible()
    expect(within(panel).getByLabelText('0 of 5 favourites saved')).toBeVisible()
  })

  it('renders an enabled, labelled city search combobox', () => {
    render(<App />)
    const search = screen.getByRole('combobox', { name: 'Search for a city' })
    expect(search).toBeEnabled()
    expect(search).toHaveAttribute('aria-autocomplete', 'list')
  })

  it('toggles the theme from the header without reloading', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement).toHaveClass('dark')

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('shows weather for a location supplied in the URL, using the real fetch path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildForecastResponse()))
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/?lat=51.5&lon=-0.12&name=London&country=United%20Kingdom')

    render(<App />)
    expect(await screen.findByLabelText('7 degrees Celsius')).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    expect(screen.queryByText('No city selected')).toBeNull()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('latitude=51.5')
  })

  it('does not call the weather API when the theme is toggled', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildForecastResponse()))
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/?lat=51.5&lon=-0.12&name=London')

    render(<App />)
    await screen.findByLabelText('7 degrees Celsius')
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  describe('searching for a city', () => {
    const tokyo = openMeteoResult({
      id: 1850147,
      name: 'Tokyo',
      latitude: 35.6895,
      longitude: 139.69171,
      timezone: 'Asia/Tokyo',
      country: 'Japan',
      admin1: 'Tokyo',
      population: 8336599,
    })

    function stubNetwork() {
      const fetchMock = vi.fn((url: string) => {
        const host = new URL(url).host
        if (host === 'geocoding-api.open-meteo.com') {
          return Promise.resolve(jsonResponse(openMeteoResponse([tokyo])))
        }
        return Promise.resolve(jsonResponse(buildForecastResponse({ timezone: 'Asia/Tokyo' })))
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    it('selecting a suggestion loads weather for that city using its coordinates', async () => {
      const user = userEvent.setup()
      const fetchMock = stubNetwork()
      render(<App />)

      expect(screen.getByText('No city selected')).toBeVisible()
      await user.type(screen.getByRole('combobox', { name: 'Search for a city' }), 'tok')
      await user.click(await screen.findByRole('option', { name: /Tokyo/ }))

      expect(await screen.findByLabelText('7 degrees Celsius')).toBeVisible()
      expect(screen.getByRole('heading', { level: 1, name: 'Tokyo' })).toBeVisible()
      expect(screen.queryByText('No city selected')).toBeNull()

      const forecastCall = fetchMock.mock.calls
        .map((c) => new URL(c[0]))
        .find((u) => u.host === 'api.open-meteo.com')
      expect(forecastCall?.searchParams.get('latitude')).toBe('35.6895')
      expect(forecastCall?.searchParams.get('longitude')).toBe('139.69171')
      expect(forecastCall?.searchParams.get('timezone')).toBe('Asia/Tokyo')
    })

    it('selecting a different city replaces the weather being shown', async () => {
      const user = userEvent.setup()
      stubNetwork()
      window.history.replaceState({}, '', '/?lat=51.5&lon=-0.12&name=London')
      render(<App />)
      await screen.findByLabelText('7 degrees Celsius')
      expect(screen.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()

      await user.type(screen.getByRole('combobox', { name: 'Search for a city' }), 'tok')
      await user.click(await screen.findByRole('option', { name: /Tokyo/ }))

      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1, name: 'Tokyo' })).toBeVisible(),
      )
      expect(screen.queryByRole('heading', { name: 'London' })).toBeNull()
    })
  })

  describe('temperature unit', () => {
    function stubForecast() {
      const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(buildForecastResponse())))
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }
    const open = () => window.history.replaceState({}, '', '/?lat=51.5&lon=-0.12&name=London')

    it('converts the current temperature, feels-like, high/low and every forecast card', async () => {
      const user = userEvent.setup()
      stubForecast()
      open()
      render(<App />)

      expect(await screen.findByLabelText('7 degrees Celsius')).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Fahrenheit (°F)' }))

      expect(screen.getByLabelText('44 degrees Fahrenheit')).toBeVisible() // 6.7°C
      expect(screen.getByLabelText('37°F')).toBeInTheDocument() // feels like 2.9°C
      expect(screen.getByLabelText('47°F')).toBeInTheDocument() // high 8.4°C
      expect(screen.getByLabelText('40°F')).toBeInTheDocument() // low 4.7°C
      expect(screen.getByRole('listitem', { name: 'Saturday 14 November' })).toBeVisible()
      expect(screen.getByLabelText('High 49°F, low 32°F')).toBeInTheDocument() // 9.3°C / 0.1°C
      // Nothing is left in Celsius, so units are never mixed.
      expect(within(screen.getByRole('main')).queryByLabelText(/Celsius|\d°C/)).toBeNull()
    })

    it('does not refetch weather when the unit changes', async () => {
      const user = userEvent.setup()
      const fetchMock = stubForecast()
      open()
      render(<App />)
      await screen.findByLabelText('7 degrees Celsius')

      await user.click(screen.getByRole('button', { name: 'Fahrenheit (°F)' }))
      await user.click(screen.getByRole('button', { name: 'Celsius (°C)' }))
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('remembers the unit after a reload', async () => {
      const user = userEvent.setup()
      stubForecast()
      open()
      const first = render(<App />)
      await screen.findByLabelText('7 degrees Celsius')
      await user.click(screen.getByRole('button', { name: 'Fahrenheit (°F)' }))
      first.unmount()

      render(<App />)
      expect(await screen.findByLabelText('44 degrees Fahrenheit')).toBeVisible()
      expect(screen.getByRole('button', { name: 'Fahrenheit (°F)' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('responsive navigation (class-level; real visibility is verified in Playwright)', () => {
    it('shows the weather view by default: sidebar hidden below md, main visible', () => {
      render(<App />)
      expect(screen.getByRole('main')).not.toHaveClass('hidden')
      expect(screen.getByRole('complementary', { name: 'Saved cities', hidden: true })).toHaveClass('hidden', 'md:block')
      expect(screen.getByRole('button', { name: 'Weather' })).toHaveAttribute('aria-current', 'page')
    })

    it('the Favourites tab swaps the views, and Weather swaps them back', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: 'Favourites' }))
      expect(screen.getByRole('main', { hidden: true })).toHaveClass('hidden', 'md:block')
      expect(screen.getByRole('complementary', { name: 'Saved cities' })).not.toHaveClass('hidden')
      expect(screen.getByRole('button', { name: 'Favourites' })).toHaveAttribute('aria-current', 'page')

      await user.click(screen.getByRole('button', { name: 'Weather' }))
      expect(screen.getByRole('main')).not.toHaveClass('hidden')
    })

    it('choosing a favourite returns to the weather view and loads that city', async () => {
      const user = userEvent.setup()
      window.localStorage.setItem(
        'weatherboard:favourites',
        JSON.stringify([{ id: 'x', name: 'Paris', latitude: 48.85, longitude: 2.35 }]),
      )
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(buildForecastResponse()))))
      render(<App />)

      await user.click(screen.getByRole('button', { name: /^Favourites/ }))
      await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^Paris/ }))

      expect(screen.getByRole('main')).not.toHaveClass('hidden')
      expect(screen.getByRole('button', { name: /^Favourites/ })).not.toHaveAttribute('aria-current')
      expect(await screen.findByLabelText('7 degrees Celsius')).toBeVisible()
    })

    it('the skip link makes the weather view visible first', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: 'Favourites' }))
      await user.click(screen.getByRole('link', { name: 'Skip to main content' }))
      expect(screen.getByRole('main')).not.toHaveClass('hidden')
    })

    it('shows the number of saved favourites on the tab', () => {
      window.localStorage.setItem(
        'weatherboard:favourites',
        JSON.stringify([
          { id: 'a', name: 'A', latitude: 1, longitude: 1 },
          { id: 'b', name: 'B', latitude: 20, longitude: 20 },
        ]),
      )
      render(<App />)
      expect(screen.getByRole('button', { name: 'Favourites, 2 of 5 saved' })).toBeVisible()
    })
  })
})
