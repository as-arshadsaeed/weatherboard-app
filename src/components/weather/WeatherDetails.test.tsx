import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CurrentWeather } from '@/components/weather/CurrentWeather'
import { WeatherDetails } from '@/components/weather/WeatherDetails'
import { parseForecastResponse } from '@/services/weatherApi'
import { buildForecastResponse } from '@/test/fixtures/openMeteo'
import type { City } from '@/types/city'

const city: City = { id: 'l', name: 'London', latitude: 51.5, longitude: -0.12 }

function reportWith(mutate: (body: ReturnType<typeof buildForecastResponse>) => void = () => {}) {
  const body = buildForecastResponse()
  mutate(body)
  return parseForecastResponse(body, 1_700_000_000_000)
}

/** The <dd> value text for a labelled card. */
function card(label: string) {
  return screen.getByText(label, { selector: 'dt' }).closest('div') as HTMLElement
}

describe('WeatherDetails', () => {
  it('shows humidity, wind speed, wind direction, precipitation, sunrise and sunset', () => {
    render(<WeatherDetails report={reportWith()} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Today’s details' })).toBeVisible()

    expect(card('Humidity')).toHaveTextContent('64%')
    expect(card('Wind speed')).toHaveTextContent('12 km/h') // 11.9 rounded
    expect(card('Wind direction')).toHaveTextContent('From N')
    expect(card('Wind direction')).toHaveTextContent('358°')
    expect(card('Precipitation')).toHaveTextContent('0%')
    expect(card('Precipitation')).toHaveTextContent('Chance today')
    expect(card('Sunrise')).toHaveTextContent(/0?7:13/)
    expect(card('Sunset')).toHaveTextContent(/(4:15 PM|16:15)/)
    expect(card('Sunrise')).toHaveTextContent('Local time')
  })

  it('expands abbreviations for assistive technology', () => {
    render(<WeatherDetails report={reportWith()} />)
    expect(within(card('Humidity')).getByLabelText('64 percent')).toBeInTheDocument()
    expect(within(card('Wind speed')).getByLabelText('12 kilometres per hour')).toBeInTheDocument()
    expect(
      within(card('Wind direction')).getByLabelText('From the north, 358 degrees'),
    ).toBeInTheDocument()
    expect(within(card('Precipitation')).getByLabelText('0 percent chance')).toBeInTheDocument()
  })

  it('names a diagonal wind direction correctly', () => {
    render(<WeatherDetails report={reportWith((b) => (b.current.wind_direction_10m = 315))} />)
    expect(card('Wind direction')).toHaveTextContent('From NW')
    expect(
      within(card('Wind direction')).getByLabelText('From the north-west, 315 degrees'),
    ).toBeInTheDocument()
  })

  it('shows "Not available" for each missing value instead of a number', () => {
    const report = reportWith((b) => {
      b.current.relative_humidity_2m = null
      b.current.wind_speed_10m = null
      b.current.wind_direction_10m = null
      b.daily.precipitation_probability_max[0] = null
      b.daily.sunrise[0] = null
      b.daily.sunset[0] = null
    })
    render(<WeatherDetails report={report} />)
    for (const label of ['Humidity', 'Wind speed', 'Wind direction', 'Precipitation', 'Sunrise', 'Sunset']) {
      expect(card(label), label).toHaveTextContent('Not available')
    }
    expect(screen.queryByText('0%')).toBeNull() // never an invented 0%
  })

  it('handles polar day/night, where only sunrise and sunset are absent', () => {
    const report = reportWith((b) => {
      b.daily.sunrise[0] = ''
      b.daily.sunset[0] = ''
    })
    render(<WeatherDetails report={report} />)
    expect(card('Sunrise')).toHaveTextContent('Not available')
    expect(card('Sunset')).toHaveTextContent('Not available')
    expect(card('Humidity')).toHaveTextContent('64%')
  })

  it('uses the wall-clock times of the city, not the viewer’s timezone', () => {
    const report = reportWith((b) => {
      b.timezone = 'Asia/Tokyo'
      b.daily.sunrise[0] = '2026-11-12T06:08'
      b.daily.sunset[0] = '2026-11-12T16:32'
    })
    render(<WeatherDetails report={report} />)
    expect(card('Sunrise')).toHaveTextContent(/0?6:08/)
    expect(card('Sunset')).toHaveTextContent(/(4:32 PM|16:32)/)
  })
})

describe('CurrentWeather with missing values', () => {
  it('shows "Not available" for feels-like but keeps the rest', () => {
    const report = reportWith((b) => (b.current.apparent_temperature = null))
    render(<CurrentWeather city={city} report={report} unit="celsius" />)
    expect(card('Feels like')).toHaveTextContent('Not available')
    expect(card('High')).toHaveTextContent('8°')
    expect(screen.getByLabelText('7 degrees Celsius')).toBeVisible()
  })

  it('renders an action slot (used for the favourite button)', () => {
    render(
      <CurrentWeather city={city} report={reportWith()} unit="celsius" action={<button>Save</button>} />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible()
  })
})
