import { beforeEach, describe, expect, it } from 'vitest'

import {
  ANIMATED_ICON_NAMES,
  hasWeatherAnimation,
  isAnimationData,
  loadWeatherAnimation,
  resetWeatherAnimationCache,
} from '@/services/weatherAnimations'
import { describeWeather, type WeatherIconName } from '@/utils/weatherCodes'

beforeEach(() => resetWeatherAnimationCache())

describe('animation coverage', () => {
  it('has an animation for every icon any weather code can produce, day or night', () => {
    const icons = new Set<WeatherIconName>()
    for (let code = 0; code <= 99; code++) {
      icons.add(describeWeather(code, true).icon)
      icons.add(describeWeather(code, false).icon)
    }
    expect(icons.size).toBeGreaterThanOrEqual(12)
    expect([...icons].filter((icon) => !hasWeatherAnimation(icon))).toEqual([])
  })

  it('ships no unused animation files', () => {
    const used = new Set<string>()
    for (let code = 0; code <= 99; code++) {
      used.add(describeWeather(code, true).icon)
      used.add(describeWeather(code, false).icon)
    }
    expect(ANIMATED_ICON_NAMES.filter((name) => !used.has(name))).toEqual([])
  })
})

describe('the bundled animation files', () => {
  it.each(ANIMATED_ICON_NAMES)('%s is valid, loops seamlessly and uses design-token classes', async (name) => {
    const data = await loadWeatherAnimation(name as WeatherIconName)
    expect(data).not.toBeNull()
    const animation = data as unknown as {
      w: number
      h: number
      fr: number
      ip: number
      op: number
      layers: Array<{ cl?: string }>
    }
    expect(animation.w).toBe(animation.h) // square, so the box never needs letterboxing
    expect(animation.op - animation.ip).toBe(120) // one shared 4 s loop at 30 fps
    // Every layer is coloured through a class the stylesheet maps to a --weather-* token.
    expect(animation.layers.every((layer) => /^wb-(sun|cloud|rain|snow|storm|night)$/.test(layer.cl ?? ''))).toBe(true)
  })

  it('keeps every file small enough to be loaded on demand', async () => {
    const sizes = await Promise.all(
      ANIMATED_ICON_NAMES.map(async (name) => JSON.stringify(await loadWeatherAnimation(name as WeatherIconName)).length),
    )
    expect(Math.max(...sizes)).toBeLessThan(20 * 1024)
  })
})

describe('isAnimationData', () => {
  const valid = { w: 96, h: 96, fr: 30, ip: 0, op: 120, layers: [{}] }

  it('accepts data the player can draw', () => {
    expect(isAnimationData(valid)).toBe(true)
  })

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['an array', []],
    ['no layers', { ...valid, layers: [] }],
    ['layers that are not an array', { ...valid, layers: 'x' }],
    ['zero size', { ...valid, w: 0 }],
    ['a non-numeric frame rate', { ...valid, fr: '30' }],
    ['an end before the start', { ...valid, ip: 10, op: 5 }],
    ['NaN timing', { ...valid, op: Number.NaN }],
  ])('rejects %s', (_label, value) => {
    expect(isAnimationData(value)).toBe(false)
  })
})

describe('loadWeatherAnimation', () => {
  it('returns null (not an error) for an icon without an animation', async () => {
    await expect(loadWeatherAnimation('not-an-icon' as WeatherIconName)).resolves.toBeNull()
  })

  it('shares one request between callers', async () => {
    const first = loadWeatherAnimation('sun')
    expect(loadWeatherAnimation('sun')).toBe(first)
    await first
  })
})
