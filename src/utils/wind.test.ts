import { describe, expect, it } from 'vitest'

import { degreesToCompass } from '@/utils/wind'

describe('degreesToCompass', () => {
  it.each([
    [0, 'N'],
    [11, 'N'],
    [12, 'NNE'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
    [348, 'NNW'],
    [358, 'N'],
    [360, 'N'],
  ])('%i° is %s', (degrees, expected) => {
    expect(degreesToCompass(degrees).short).toBe(expected)
  })

  it('wraps bearings outside 0–360', () => {
    expect(degreesToCompass(-90).short).toBe('W')
    expect(degreesToCompass(450).short).toBe('E')
  })

  it('provides a spoken form for screen readers', () => {
    expect(degreesToCompass(337.5).spoken).toBe('north-north-west')
    expect(degreesToCompass(90).spoken).toBe('east')
  })
})
