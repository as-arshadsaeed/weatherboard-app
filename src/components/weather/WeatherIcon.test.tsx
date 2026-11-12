import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { WeatherIcon } from '@/components/weather/WeatherIcon'
import * as animations from '@/services/weatherAnimations'

/** What the component asked the (mocked) Lottie player to do. */
const player = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  instances: [] as Array<{ play: Mock; pause: Mock; destroy: Mock }>,
  fail: false,
}))

vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: {
    loadAnimation: (config: Record<string, unknown>) => {
      if (player.fail) throw new Error('player exploded')
      player.calls.push(config)
      const instance = { play: vi.fn(), pause: vi.fn(), destroy: vi.fn() }
      player.instances.push(instance)
      return instance
    },
  },
}))

const CLEAR_DAY = 0
const RAIN = 61
const tile = (container: HTMLElement) => container.querySelector('[data-weather-icon]') as HTMLElement
const animationBox = (container: HTMLElement) => container.querySelector('.lottie-icon') as HTMLElement | null
const staticGlyph = (container: HTMLElement) => tile(container).querySelector('svg.lucide') as SVGElement | null

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  player.calls.length = 0
  player.instances.length = 0
  player.fail = false
  animations.resetWeatherAnimationCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('WeatherIcon animation', () => {
  it('shows the static icon straight away, then swaps in the animation without changing the tile', async () => {
    const { container } = render(<WeatherIcon code={CLEAR_DAY} size="lg" />)
    const before = tile(container).className
    expect(staticGlyph(container)).toBeVisible() // nothing waits on the network

    await waitFor(() => expect(player.calls).toHaveLength(1))
    await waitFor(() => expect(staticGlyph(container)).toHaveClass('hidden'))
    expect(animationBox(container)).not.toHaveClass('hidden')
    expect(tile(container).className).toBe(before) // fixed-size tile: no layout shift
  })

  it('asks the player for the right looping, non-autoplaying SVG animation', async () => {
    render(<WeatherIcon code={RAIN} />)
    await waitFor(() => expect(player.calls).toHaveLength(1))
    const config = player.calls[0]!
    expect(config).toMatchObject({ renderer: 'svg', loop: true, autoplay: false })
    expect((config.animationData as { nm: string }).nm).toBe('weatherboard-rain')
    expect(config.rendererSettings).toMatchObject({ focusable: false })
  })

  it('hands every icon its own copy of the data, because the player mutates it', async () => {
    render(
      <>
        <WeatherIcon code={CLEAR_DAY} />
        <WeatherIcon code={CLEAR_DAY} />
      </>,
    )
    await waitFor(() => expect(player.calls).toHaveLength(2))
    expect(player.calls[0]!.animationData).not.toBe(player.calls[1]!.animationData)
  })

  it('uses the night artwork after dark', async () => {
    render(<WeatherIcon code={CLEAR_DAY} isDay={false} />)
    await waitFor(() => expect(player.calls).toHaveLength(1))
    expect((player.calls[0]!.animationData as { nm: string }).nm).toBe('weatherboard-moon')
  })

  it('switches animation when the condition changes, destroying the old one', async () => {
    const { rerender, container } = render(<WeatherIcon code={CLEAR_DAY} />)
    await waitFor(() => expect(player.calls).toHaveLength(1))
    rerender(<WeatherIcon code={RAIN} />)
    await waitFor(() => expect(player.calls).toHaveLength(2))
    expect(player.instances[0]!.destroy).toHaveBeenCalled()
    expect(tile(container)).toHaveAttribute('data-weather-icon', 'rain')
  })

  it('destroys the animation on unmount', async () => {
    const { unmount } = render(<WeatherIcon code={CLEAR_DAY} />)
    await waitFor(() => expect(player.calls).toHaveLength(1))
    unmount()
    expect(player.instances[0]!.destroy).toHaveBeenCalled()
  })

  it('plays only while on screen', async () => {
    let notify: IntersectionObserverCallback = () => {}
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    render(<WeatherIcon code={CLEAR_DAY} />)
    await waitFor(() => expect(player.calls).toHaveLength(1))
    const instance = player.instances[0]!

    notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(instance.pause).toHaveBeenCalled()
    instance.play.mockClear()
    notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(instance.play).toHaveBeenCalled()
  })
})

describe('WeatherIcon fallbacks', () => {
  it('keeps the static icon when the player cannot be loaded', async () => {
    vi.spyOn(animations, 'loadLottiePlayer').mockResolvedValue(null)
    const { container } = render(<WeatherIcon code={CLEAR_DAY} />)
    await waitFor(() => expect(animations.loadLottiePlayer).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(staticGlyph(container)).toBeVisible()
    expect(animationBox(container)).toHaveClass('hidden')
  })

  it('keeps the static icon when the animation data is missing or invalid', async () => {
    vi.spyOn(animations, 'loadWeatherAnimation').mockResolvedValue(null)
    const { container } = render(<WeatherIcon code={CLEAR_DAY} />)
    await waitFor(() => expect(animations.loadWeatherAnimation).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(player.calls).toHaveLength(0)
    expect(staticGlyph(container)).toBeVisible()
  })

  it('keeps the static icon (and does not throw) when the player fails while drawing', async () => {
    player.fail = true
    const { container } = render(<WeatherIcon code={CLEAR_DAY} />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(staticGlyph(container)).toBeVisible()
    expect(animationBox(container)).toHaveClass('hidden')
  })

  it('is static when animated is turned off, without even loading the player', async () => {
    const loadPlayer = vi.spyOn(animations, 'loadLottiePlayer')
    const { container } = render(<WeatherIcon code={CLEAR_DAY} animated={false} />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(loadPlayer).not.toHaveBeenCalled()
    expect(animationBox(container)).toBeNull()
    expect(staticGlyph(container)).toBeVisible()
  })
})

describe('WeatherIcon and reduced motion', () => {
  it('shows only the static icon, and never downloads the player or an animation', async () => {
    stubReducedMotion(true)
    const loadPlayer = vi.spyOn(animations, 'loadLottiePlayer')
    const loadData = vi.spyOn(animations, 'loadWeatherAnimation')
    const { container } = render(<WeatherIcon code={CLEAR_DAY} size="lg" />)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(animationBox(container)).toBeNull()
    expect(staticGlyph(container)).toBeVisible()
    expect(loadPlayer).not.toHaveBeenCalled()
    expect(loadData).not.toHaveBeenCalled()
    expect(player.calls).toHaveLength(0)
  })

  it('animates when reduced motion is not requested', async () => {
    stubReducedMotion(false)
    render(<WeatherIcon code={CLEAR_DAY} />)
    await waitFor(() => expect(player.calls).toHaveLength(1))
  })
})

describe('WeatherIcon accessibility', () => {
  it('is decorative: hidden from assistive technology and adds nothing to announce', async () => {
    const { container } = render(<WeatherIcon code={RAIN} />)
    await waitFor(() => expect(player.calls).toHaveLength(1))
    expect(tile(container)).toHaveAttribute('aria-hidden', 'true')
    expect(animationBox(container)).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('[aria-label], [title], [role]')).toBeNull()
    expect(container).toHaveTextContent('') // no visible or hidden text of its own
  })
})
