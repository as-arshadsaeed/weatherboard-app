import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { clearCitySearchCache } from '@/services/citySearch'
import { resetStorageStateForTests } from '@/services/storageService'
import { loadWeatherSnapshot, saveWeatherSnapshot } from '@/services/weatherCache'
import { berlin, london, paris } from '@/test/cities'
import { openMeteoResponse, openMeteoResult } from '@/test/fixtures/geocoding'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import { buildReport } from '@/test/fixtures/report'

let temperature = 6.7
let forecastBehaviour: 'ok' | 'network-error' | 'outage' = 'ok'
let fetchMock: ReturnType<typeof vi.fn>

function setOnLine(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}
const goOffline = () => {
  setOnLine(false)
  act(() => void window.dispatchEvent(new Event('offline')))
}
const goOnline = () => {
  setOnLine(true)
  act(() => void window.dispatchEvent(new Event('online')))
}
const forecastRequests = () => fetchMock.mock.calls.filter((c) => new URL(String(c[0])).host === 'api.open-meteo.com')

beforeEach(() => {
  temperature = 6.7
  forecastBehaviour = 'ok'
  resetStorageStateForTests()
  clearCitySearchCache()
  setOnLine(true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  fetchMock = vi.fn((url: string) => {
    const u = new URL(url)
    if (u.host === 'geocoding-api.open-meteo.com') {
      return Promise.resolve(jsonResponse(openMeteoResponse([openMeteoResult({ id: 2643743, name: 'London', latitude: 51.50853, longitude: -0.12574, admin1: 'England', country: 'United Kingdom' })])))
    }
    if (forecastBehaviour === 'network-error') return Promise.reject(new TypeError('Failed to fetch'))
    if (forecastBehaviour === 'outage') return Promise.resolve(new Response('', { status: 503 }))
    const base = buildForecastResponse()
    return Promise.resolve(jsonResponse(buildForecastResponse({ current: { ...base.current, temperature_2m: temperature } })))
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

const open = (cityName = 'London') => window.history.replaceState({}, '', `/?lat=51.5085&lon=-0.1257&name=${cityName}`)

describe('viewing weather online saves it for later', () => {
  it('saves the forecast that was shown, with the time it was retrieved', async () => {
    open()
    render(<App />)
    expect(await screen.findByText('7 degrees Celsius')).toBeVisible()
    await waitFor(async () => expect(await loadWeatherSnapshot(london)).not.toBeNull())
    expect((await loadWeatherSnapshot(london))?.report.current.temperatureC).toBe(6.7)
  })

  it('shows no offline banner or saved-weather notice when everything works', async () => {
    open()
    render(<App />)
    await screen.findByText('7 degrees Celsius')
    expect(screen.queryByText('You’re offline.')).toBeNull()
    expect(screen.queryByRole('status', { name: 'Saved weather' })).toBeNull()
  })
})

describe('opening the app offline', () => {
  it('shows the last saved weather for the city, clearly labelled, with its timestamp and the banner', async () => {
    await saveWeatherSnapshot(london, buildReport(Date.now() - 2 * 3_600_000, 4.2))
    setOnLine(false)
    open()
    render(<App />)

    expect(await screen.findByText('4 degrees Celsius')).toBeVisible()
    expect(screen.getByText('You’re offline.')).toBeVisible() // the banner
    const notice = screen.getByRole('status', { name: 'Saved weather' })
    expect(notice).toHaveTextContent('Showing saved weather.')
    expect(notice).toHaveTextContent('about 2 hours ago')
    expect(notice).toHaveTextContent('Conditions may have changed since then.')
    expect(forecastRequests()).toHaveLength(0) // no pointless requests while offline
    // The rest of the dashboard still renders from the saved data.
    expect(screen.getByText('Humidity')).toBeVisible()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText(/Weather data by/)).toBeVisible()
  })

  it('says there is no saved weather for a city that was never viewed — and never invents any', async () => {
    await saveWeatherSnapshot(london, buildReport(Date.now(), 4.2))
    setOnLine(false)
    window.history.replaceState({}, '', '/?lat=52.52&lon=13.405&name=Berlin')
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You’re offline, and no saved weather is available for this city. Connect to the internet to load it.',
    )
    expect(screen.queryByText(/degrees/)).toBeNull()
    expect(screen.queryByRole('status', { name: 'Saved weather' })).toBeNull()
  })

  it('switching to a favourite offline: saved ones show, unsaved ones are honest about it', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('weatherboard:favourites', JSON.stringify([london, berlin]))
    await saveWeatherSnapshot(london, buildReport(Date.now() - 600_000, 4.2))
    setOnLine(false)
    render(<App />)
    const panel = screen.getByRole('region', { name: 'Favourites' })

    await user.click(within(panel).getByRole('button', { name: /^London/ }))
    expect(await screen.findByText('4 degrees Celsius')).toBeVisible()

    await user.click(within(panel).getByRole('button', { name: /^Berlin/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no saved weather is available for this city')
    expect(screen.queryByText(/degrees/)).toBeNull()
  })

  it('keeps the saved weather available across a "reload" (a fresh mount)', async () => {
    open()
    const first = render(<App />)
    await screen.findByText('7 degrees Celsius')
    await waitFor(async () => expect(await loadWeatherSnapshot(london)).not.toBeNull())
    first.unmount()

    setOnLine(false)
    render(<App />)
    expect(await screen.findByText('7 degrees Celsius')).toBeVisible()
    expect(screen.getByRole('status', { name: 'Saved weather' })).toBeVisible()
  })
})

describe('connectivity changes while the app is open', () => {
  it('shows saved weather when the connection drops, then fresh weather when it returns', async () => {
    open()
    render(<App />)
    await screen.findByText('7 degrees Celsius')
    await waitFor(async () => expect(await loadWeatherSnapshot(london)).not.toBeNull())

    goOffline()
    expect(await screen.findByRole('status', { name: 'Saved weather' })).toHaveTextContent('You’re offline')
    expect(screen.getByText('You’re offline.', { selector: 'span' })).toBeVisible()

    temperature = 12.4 // the weather changed while we were away
    goOnline()
    expect(await screen.findByText('12 degrees Celsius')).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Saved weather' })).toBeNull())
    expect(screen.getByText('You’re back online.')).toBeVisible()
    await waitFor(async () => expect((await loadWeatherSnapshot(london))?.report.current.temperatureC).toBe(12.4))
  })

  it('when the browser says online but the service is unreachable, it shows saved weather with "Try again"', async () => {
    const user = userEvent.setup()
    await saveWeatherSnapshot(london, buildReport(Date.now() - 900_000, 4.2))
    forecastBehaviour = 'network-error'
    open()
    render(<App />)

    expect(await screen.findByText('4 degrees Celsius')).toBeVisible()
    expect(screen.getByRole('status', { name: 'Saved weather' })).toHaveTextContent('Can’t reach the weather service')
    expect(screen.queryByText('You’re offline.')).toBeNull() // we are not offline, so we do not claim it

    forecastBehaviour = 'ok'
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('7 degrees Celsius')).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Saved weather' })).toBeNull())
  })

  it('a failing service with nothing saved shows the normal error, and saves nothing', async () => {
    forecastBehaviour = 'outage'
    open()
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable')
    expect(await loadWeatherSnapshot(london)).toBeNull()
  })
})

describe('the unit toggle on saved weather', () => {
  it('converts saved temperatures too, with no request', async () => {
    const user = userEvent.setup()
    await saveWeatherSnapshot(london, buildReport(Date.now(), 6.7))
    setOnLine(false)
    open()
    render(<App />)
    await screen.findByText('7 degrees Celsius')
    await user.click(screen.getByRole('button', { name: 'Fahrenheit (°F)' }))
    expect(screen.getByText('44 degrees Fahrenheit')).toBeVisible()
    expect(forecastRequests()).toHaveLength(0)
  })
})

describe('storage problems', () => {
  it('still works online when IndexedDB is unavailable (just without offline support)', async () => {
    vi.stubGlobal('indexedDB', undefined)
    open()
    render(<App />)
    expect(await screen.findByText('7 degrees Celsius')).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Saved weather' })).toBeNull()
  })

  it('offline with IndexedDB unavailable says there is no saved weather', async () => {
    vi.stubGlobal('indexedDB', undefined)
    setOnLine(false)
    open()
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('no saved weather is available')
  })

  it('paris is not berlin: saved data is per city', async () => {
    await saveWeatherSnapshot(paris, buildReport(Date.now(), 12))
    setOnLine(false)
    window.history.replaceState({}, '', '/?lat=52.52&lon=13.405&name=Berlin')
    render(<App />)
    expect(await screen.findByRole('alert')).toBeVisible()
  })
})
