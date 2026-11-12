import { describe, expect, it } from 'vitest'

import {
  areValidCoordinates,
  formatCoordinates,
  isValidLatitude,
  isValidLongitude,
  normalizeSearchQuery,
  parseCityFromSearch,
} from '@/utils/validation'

describe('coordinate validation', () => {
  it('accepts values inside range, including the limits', () => {
    expect(isValidLatitude(90)).toBe(true)
    expect(isValidLatitude(-90)).toBe(true)
    expect(isValidLongitude(180)).toBe(true)
    expect(areValidCoordinates(35.68, 139.65)).toBe(true)
  })

  it.each([[91], [-90.0001], [NaN], [Infinity]])('rejects latitude %s', (value) => {
    expect(isValidLatitude(value)).toBe(false)
  })

  it.each([[181], [-180.5], [NaN]])('rejects longitude %s', (value) => {
    expect(isValidLongitude(value)).toBe(false)
  })

  it('formats hemispheres', () => {
    expect(formatCoordinates(51.5072, -0.1276)).toBe('51.51°N, 0.13°W')
    expect(formatCoordinates(-33.87, 151.21)).toBe('33.87°S, 151.21°E')
  })
})

describe('parseCityFromSearch', () => {
  it('returns null when coordinates are not supplied', () => {
    expect(parseCityFromSearch('')).toBeNull()
    expect(parseCityFromSearch('?lat=10')).toBeNull()
    expect(parseCityFromSearch('?name=Paris')).toBeNull()
  })

  it('parses a full location', () => {
    expect(
      parseCityFromSearch('?lat=35.68&lon=139.65&name=Tokyo&country=Japan&region=Tokyo&tz=Asia/Tokyo'),
    ).toMatchObject({
      name: 'Tokyo',
      country: 'Japan',
      region: 'Tokyo',
      latitude: 35.68,
      longitude: 139.65,
      timezone: 'Asia/Tokyo',
    })
  })

  it('falls back to formatted coordinates when no name is given', () => {
    expect(parseCityFromSearch('?lat=51.5072&lon=-0.1276')?.name).toBe('51.51°N, 0.13°W')
  })

  it('passes non-numeric or out-of-range coordinates through for the service to reject', () => {
    const bad = parseCityFromSearch('?lat=abc&lon=')
    expect(bad).not.toBeNull()
    expect(Number.isNaN(bad?.latitude)).toBe(true)
    expect(Number.isNaN(bad?.longitude)).toBe(true)
    expect(bad?.name).toBe('Selected location')
    expect(parseCityFromSearch('?lat=999&lon=0')?.latitude).toBe(999)
  })
})

describe('normalizeSearchQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSearchQuery('  new   york \t')).toBe('new york')
    expect(normalizeSearchQuery('   ')).toBe('')
  })
})
