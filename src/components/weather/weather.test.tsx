import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CurrentWeather } from '@/components/weather/CurrentWeather'
import { FiveDayForecast } from '@/components/weather/FiveDayForecast'
import { WeatherDashboard } from '@/components/weather/WeatherDashboard'
import { buildForecastResponse, jsonResponse } from '@/test/fixtures/openMeteo'
import { parseForecastResponse } from '@/services/weatherApi'
import type { City } from '@/types/city'

const london: City = {
  id: 'london',
  name: 'London',
  region: 'England',
  country: 'United Kingdom',
  latitude: 51.5,
  longitude: -0.12,
}
const report = parseForecastResponse(buildForecastResponse(), 1_700_000_000_000)

describe('CurrentWeather', () => {
  it('shows city, region and country, temperature, condition, feels-like, high and low', () => {
    render(<CurrentWeather city={london} report={report} unit="celsius" />)

    expect(screen.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    expect(screen.getByText('England, United Kingdom')).toBeVisible()
    expect(screen.getByText('7 degrees Celsius')).toBeVisible()
    expect(screen.getByText('Partly cloudy')).toBeVisible()
    expect(screen.getByText('local time')).toBeVisible()

    expect(screen.getByText('Feels like').closest('div')).toHaveTextContent('3°')
    expect(screen.getByText('High').closest('div')).toHaveTextContent('8°')
    expect(screen.getByText('Low').closest('div')).toHaveTextContent('5°')
  })

  it('exposes full units to assistive technology', () => {
    render(<CurrentWeather city={london} report={report} unit="celsius" />)
    expect(screen.getByText('3°C')).toBeInTheDocument()
  })

  it('renders in Fahrenheit consistently without mixing units', () => {
    render(<CurrentWeather city={london} report={report} unit="fahrenheit" />)
    expect(screen.getByText('44 degrees Fahrenheit')).toBeVisible()
    expect(screen.queryByLabelText(/Celsius/)).toBeNull()
  })

  it('omits the region line when the city has none', () => {
    render(<CurrentWeather city={{ ...london, region: undefined, country: undefined }} report={report} unit="celsius" />)
    expect(screen.queryByText(/United Kingdom/)).toBeNull()
  })
})

describe('FiveDayForecast', () => {
  it('renders exactly five cards starting with Today', () => {
    render(<FiveDayForecast days={report.daily} unit="celsius" />)
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(within(items[0]!).getByText('Today')).toBeVisible()
    expect(within(items[1]!).getByText('Fri')).toBeVisible()
  })

  it('shows day name, description, high, low and precipitation chance on each card', () => {
    render(<FiveDayForecast days={report.daily} unit="celsius" />)
    const rainy = screen.getByRole('listitem', { name: 'Saturday 14 November' })
    expect(within(rainy).getByText('Light rain')).toBeVisible()
    expect(within(rainy).getByText('High 9°C, low 0°C')).toBeInTheDocument()
    expect(within(rainy).getByText('82 percent chance of precipitation')).toBeInTheDocument()
  })

  it('says so when precipitation chance is unavailable instead of showing 0%', () => {
    render(<FiveDayForecast days={report.daily} unit="celsius" />)
    const last = screen.getByRole('listitem', { name: 'Monday 16 November' })
    expect(within(last).getByText('Chance of precipitation not available')).toBeInTheDocument()
    expect(within(last).queryByText('0%')).toBeNull()
  })

  it('shows sub-zero lows without a negative-zero artefact', () => {
    render(<FiveDayForecast days={report.daily} unit="celsius" />)
    const last = screen.getByRole('listitem', { name: 'Monday 16 November' })
    expect(within(last).getByText('High 9°C, low 0°C')).toBeInTheDocument()
  })

  it('converts every card when the unit changes', () => {
    render(<FiveDayForecast days={report.daily} unit="fahrenheit" />)
    const first = screen.getByRole('listitem', { name: 'Today, Thursday 12 November' })
    expect(within(first).getByText('High 47°F, low 40°F')).toBeInTheDocument()
  })
})

describe('WeatherDashboard', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows a loading state with the real city name but no weather values', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    render(<WeatherDashboard city={london} unit="celsius" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading weather for London…')
    expect(screen.getByRole('heading', { level: 1, name: 'London' })).toBeVisible()
    expect(document.body.textContent).not.toMatch(/\d\s*°/)
    expect(screen.queryByText('Weather data by')).toBeNull()
  })

  it('shows weather, the forecast and the Open-Meteo attribution on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    render(<WeatherDashboard city={london} unit="celsius" />)

    expect(await screen.findByText('7 degrees Celsius')).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText(/Weather data by/)).toHaveTextContent('Weather data by Open-Meteo.com')
    expect(screen.getByRole('link', { name: 'Open-Meteo.com' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/',
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a specific, actionable error on network failure and recovers on retry', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<WeatherDashboard city={london} unit="celsius" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to retrieve weather data. Check your internet connection and try again.',
    )
    expect(screen.queryByText(/something went wrong/i)).toBeNull()

    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('7 degrees Celsius')).toBeVisible()
  })

  it('shows no retry button when the location itself is invalid', async () => {
    render(
      <WeatherDashboard
        city={{ id: 'x', name: 'Nowhere', latitude: 999, longitude: 0 }}
        unit="celsius"
      />,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Weather data is unavailable for this location.',
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an unavailable message for service errors', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }))
    render(<WeatherDashboard city={london} unit="celsius" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The weather service is temporarily unavailable',
    )
  })

  it('does not refetch when only the unit changes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(buildForecastResponse()))
    const { rerender } = render(<WeatherDashboard city={london} unit="celsius" />)
    await screen.findByText('7 degrees Celsius')

    rerender(<WeatherDashboard city={london} unit="fahrenheit" />)
    expect(screen.getByText('44 degrees Fahrenheit')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
