import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import { resetStorageStateForTests } from '@/services/storageService'

beforeEach(() => {
  resetStorageStateForTests()
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

  it('renders the city search as clearly disabled until it is built', () => {
    render(<App />)
    const search = screen.getByRole('searchbox', { name: 'Search for a city' })
    expect(search).toBeDisabled()
    expect(search).toHaveAccessibleDescription('City search is not available yet.')
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
})
