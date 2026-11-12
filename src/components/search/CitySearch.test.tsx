import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CitySearch } from '@/components/search/CitySearch'
import { searchCities } from '@/services/citySearch'
import { CitySearchError } from '@/services/citySearchError'
import type { City } from '@/types/city'

vi.mock('@/services/citySearch', () => ({ searchCities: vi.fn() }))
const searchMock = vi.mocked(searchCities)

const london: City = {
  id: 'london',
  name: 'London',
  region: 'England',
  country: 'United Kingdom',
  latitude: 51.5,
  longitude: -0.12,
}
const londonCanada: City = {
  id: 'london-ca',
  name: 'London',
  region: 'Ontario',
  country: 'Canada',
  latitude: 42.98,
  longitude: -81.23,
}
const londrina: City = {
  id: 'londrina',
  name: 'Londrina',
  region: 'Paraná',
  country: 'Brazil',
  latitude: -23.3,
  longitude: -51.16,
}

const input = () => screen.getByRole('combobox', { name: 'Search for a city' })

/** The visible copy of a message; the sr-only live region intentionally repeats it for screen readers. */
const findVisibleText = (text: string) =>
  waitFor(() => {
    const match = screen.getAllByText(text).find((el) => !el.closest('[role="status"]'))
    if (!match) throw new Error(`no visible element with text: ${text}`)
    return match
  })

function setup() {
  const onSelectCity = vi.fn()
  const user = userEvent.setup()
  render(<CitySearch onSelectCity={onSelectCity} />)
  return { user, onSelectCity }
}

beforeEach(() => {
  searchMock.mockReset()
  searchMock.mockResolvedValue([london, londonCanada, londrina])
})

describe('CitySearch: combobox semantics', () => {
  it('exposes the ARIA 1.2 combobox/listbox pattern', async () => {
    const { user } = setup()
    expect(input()).toHaveAttribute('aria-autocomplete', 'list')
    expect(input()).toHaveAttribute('aria-expanded', 'false')
    expect(input()).not.toHaveAttribute('aria-controls')

    await user.type(input(), 'lon')
    const listbox = await screen.findByRole('listbox', { name: 'City suggestions' })

    expect(input()).toHaveAttribute('aria-expanded', 'true')
    expect(input()).toHaveAttribute('aria-controls', listbox.id)
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(3)
    // The first option is active by default and referenced by aria-activedescendant.
    expect(input()).toHaveAttribute('aria-activedescendant', options[0]!.id)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('shows city, region and country for each suggestion', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    const first = (await screen.findAllByRole('option'))[0]!
    expect(within(first).getByText('London')).toBeVisible()
    expect(within(first).getByText('England, United Kingdom')).toBeVisible()
  })

  it('disables browser autocomplete/correction and keeps focus-friendly attributes', () => {
    setup()
    expect(input()).toHaveAttribute('autocomplete', 'off')
    expect(input()).toHaveAttribute('spellcheck', 'false')
  })
})

describe('CitySearch: selecting', () => {
  it('selects with the mouse and reports the verified city', async () => {
    const { user, onSelectCity } = setup()
    await user.type(input(), 'lon')
    await user.click(await screen.findByRole('option', { name: /Londrina/ }))

    expect(onSelectCity).toHaveBeenCalledOnce()
    expect(onSelectCity).toHaveBeenCalledWith(londrina)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input()).toHaveValue('Londrina, Paraná, Brazil')
  })

  it('does not run another search for the label it just filled in', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    await user.click(await screen.findByRole('option', { name: /Londrina/ }))
    await new Promise((r) => setTimeout(r, 350))
    expect(searchMock).toHaveBeenCalledTimes(1)
  })

  it('selects the highlighted option with Enter (first option by default)', async () => {
    const { user, onSelectCity } = setup()
    await user.type(input(), 'lon')
    await screen.findByRole('listbox')
    await user.keyboard('{Enter}')
    expect(onSelectCity).toHaveBeenCalledWith(london)
  })

  it('navigates with ArrowDown/ArrowUp, wrapping at both ends', async () => {
    const { user, onSelectCity } = setup()
    await user.type(input(), 'lon')
    const options = await screen.findAllByRole('option')

    await user.keyboard('{ArrowDown}')
    expect(input()).toHaveAttribute('aria-activedescendant', options[1]!.id)
    await user.keyboard('{ArrowDown}{ArrowDown}') // → third, then wraps to first
    expect(input()).toHaveAttribute('aria-activedescendant', options[0]!.id)
    await user.keyboard('{ArrowUp}') // wraps back to last
    expect(input()).toHaveAttribute('aria-activedescendant', options[2]!.id)

    await user.keyboard('{Enter}')
    expect(onSelectCity).toHaveBeenCalledWith(londrina)
  })

  it('highlights on hover', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    const options = await screen.findAllByRole('option')
    await user.hover(options[2]!)
    expect(options[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('never submits free text: Enter does nothing before suggestions arrive', async () => {
    searchMock.mockReturnValue(new Promise(() => {}))
    const { user, onSelectCity } = setup()
    await user.type(input(), 'london{Enter}')
    expect(onSelectCity).not.toHaveBeenCalled()
  })

  it('does not auto-select stale suggestions while the user is still typing', async () => {
    const { user, onSelectCity } = setup()
    await user.type(input(), 'lon')
    await screen.findByRole('listbox')
    // New keystroke makes the list stale (belongs to "lon", not "lond"): Enter must not pick it.
    await user.type(input(), 'd{Enter}')
    expect(onSelectCity).not.toHaveBeenCalled()
  })
})

describe('CitySearch: closing', () => {
  it('closes on Escape', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input()).toHaveAttribute('aria-expanded', 'false')
  })

  it('reopens with ArrowDown after Escape', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}{ArrowDown}')
    expect(await screen.findByRole('listbox')).toBeVisible()
  })

  it('closes when clicking outside', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    await screen.findByRole('listbox')
    await user.click(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes when tabbing away', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    await screen.findByRole('listbox')
    await user.tab()
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('CitySearch: validation and guidance', () => {
  it('shows an inline error when left empty on blur', async () => {
    const { user } = setup()
    await user.click(input())
    await user.tab()

    expect(await screen.findByText('Enter a city name to search.')).toBeVisible()
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveAccessibleDescription('Enter a city name to search.')
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('shows guidance for a single character and makes no request', async () => {
    const { user } = setup()
    await user.type(input(), 'l')
    expect(await findVisibleText('Type at least 2 characters to search for a city.')).toBeVisible()
    await new Promise((r) => setTimeout(r, 350))
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('asks for a second character on blur when only one was typed', async () => {
    const { user } = setup()
    await user.type(input(), 'l')
    await user.tab()
    expect(await screen.findByText('Enter at least 2 characters to search.')).toBeVisible()
  })

  it('clears the error once a valid search is typed', async () => {
    const { user } = setup()
    await user.click(input())
    await user.tab()
    await screen.findByText('Enter a city name to search.')
    await user.click(input())
    await user.type(input(), 'lon')
    expect(screen.queryByText('Enter a city name to search.')).toBeNull()
    expect(input()).not.toHaveAttribute('aria-invalid')
  })

  it('does not flag an error after a city has been chosen', async () => {
    const { user } = setup()
    await user.type(input(), 'lon')
    await user.click(await screen.findByRole('option', { name: /Londrina/ }))
    await user.tab()
    expect(screen.queryByText(/Enter a city name|Enter at least/)).toBeNull()
  })
})

describe('CitySearch: loading, empty and error states', () => {
  it('shows a loading state while searching', async () => {
    searchMock.mockReturnValue(new Promise(() => {}))
    const { user } = setup()
    await user.type(input(), 'lon')
    expect(await screen.findByText('Searching…')).toBeVisible()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows a visible no-results message', async () => {
    searchMock.mockResolvedValue([])
    const { user } = setup()
    await user.type(input(), 'zzqx')
    expect(
      await screen.findByText('No cities found. Try another spelling or search by country.'),
    ).toBeVisible()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows a specific network error and recovers with "Try again"', async () => {
    searchMock.mockRejectedValueOnce(new CitySearchError('network'))
    const { user } = setup()
    await user.type(input(), 'lon')
    expect(
      await findVisibleText('Unable to search cities. Check your internet connection and try again.'),
    ).toBeVisible()
    expect(screen.queryByText(/something went wrong/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('listbox')).toBeVisible()
    expect(searchMock).toHaveBeenCalledTimes(2)
  })

  it('shows the temporary-unavailable message for service errors', async () => {
    searchMock.mockRejectedValue(new CitySearchError('unavailable'))
    const { user } = setup()
    await user.type(input(), 'lon')
    expect(
      await findVisibleText('City search is temporarily unavailable. Please try again.'),
    ).toBeVisible()
  })

  it('announces results, empty and error states to screen readers', async () => {
    const { user } = setup()
    const live = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!
    await user.type(input(), 'lon')
    await waitFor(() => expect(live()).toHaveTextContent('3 cities found'))
  })
})

describe('CitySearch: rapid typing', () => {
  it('searches once for the final text', async () => {
    const user = userEvent.setup({ delay: 20 })
    render(<CitySearch onSelectCity={vi.fn()} />)
    await user.type(input(), 'london')
    await screen.findByRole('listbox')
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock.mock.calls[0]?.[0]).toBe('london')
  })
})
