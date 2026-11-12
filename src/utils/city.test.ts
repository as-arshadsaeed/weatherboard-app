import { describe, expect, it } from 'vitest'

import { formatCityLabel, formatLocation, isSameCity } from '@/utils/city'

describe('isSameCity', () => {
  const london = { id: 'geodb:1', latitude: 51.5085, longitude: -0.1257 }

  it('matches by id', () => {
    expect(isSameCity(london, { id: 'geodb:1', latitude: 0, longitude: 0 })).toBe(true)
  })

  it('matches the same place from a different provider (different id, near-identical coordinates)', () => {
    expect(isSameCity(london, { id: 'open-meteo:2643743', latitude: 51.50853, longitude: -0.12574 })).toBe(true)
    expect(isSameCity(london, { id: 'x', latitude: 51.52, longitude: -0.14 })).toBe(true) // ~2 km
  })

  it('keeps genuinely different places apart', () => {
    expect(isSameCity(london, { id: 'x', latitude: 42.9834, longitude: -81.233 })).toBe(false) // London, Canada
    expect(isSameCity(london, { id: 'x', latitude: 51.5085, longitude: -0.2 })).toBe(false) // ~5 km away
    expect(isSameCity(london, { id: 'x', latitude: 51.7, longitude: -0.1257 })).toBe(false)
  })
})

describe('city formatting', () => {
  it('formats location and label with missing parts', () => {
    expect(formatLocation({ region: 'England', country: 'United Kingdom' })).toBe('England, United Kingdom')
    expect(formatLocation({ country: 'Japan' })).toBe('Japan')
    expect(formatLocation({})).toBe('')
    expect(formatCityLabel({ name: 'London', region: 'England', country: 'United Kingdom' })).toBe('London, England, United Kingdom')
    expect(formatCityLabel({ name: 'Nowhere' })).toBe('Nowhere')
  })
})
