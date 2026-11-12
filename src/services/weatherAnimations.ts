import type { AnimationConfigWithData, AnimationItem } from 'lottie-web'

import type { WeatherIconName } from '@/utils/weatherCodes'

/**
 * Lazy loading for the animated weather icons.
 *
 * Neither the Lottie player (~46 KB gzip) nor any animation is part of the main bundle: the player and each
 * icon's JSON are separate chunks fetched the first time they are needed. Every failure (chunk missing,
 * offline before it was cached, malformed data) resolves to `null` so the caller keeps the static icon.
 */

export type AnimationData = AnimationConfigWithData['animationData']

export interface LottiePlayer {
  loadAnimation: (config: AnimationConfigWithData<'svg'>) => AnimationItem
}

// Eager: false, so each animation is its own chunk. Vite resolves this at build time.
const ANIMATIONS = import.meta.glob('../assets/lottie/*.json', { import: 'default' }) as Record<
  string,
  () => Promise<unknown>
>

const pathFor = (name: WeatherIconName) => `../assets/lottie/${name}.json`

export const ANIMATED_ICON_NAMES: readonly string[] = Object.keys(ANIMATIONS).map((path) =>
  path.replace('../assets/lottie/', '').replace('.json', ''),
)

export function hasWeatherAnimation(name: WeatherIconName): boolean {
  return pathFor(name) in ANIMATIONS
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Minimal structural check: enough to be sure the player will get something it can draw. */
export function isAnimationData(value: unknown): value is NonNullable<AnimationData> {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  return (
    isFiniteNumber(data.w) &&
    isFiniteNumber(data.h) &&
    data.w > 0 &&
    data.h > 0 &&
    isFiniteNumber(data.fr) &&
    data.fr > 0 &&
    isFiniteNumber(data.ip) &&
    isFiniteNumber(data.op) &&
    data.op > data.ip &&
    Array.isArray(data.layers) &&
    data.layers.length > 0
  )
}

const animationRequests = new Map<WeatherIconName, Promise<AnimationData | null>>()

/** The animation for an icon, or null if it is missing, fails to load or is not valid animation data. */
export function loadWeatherAnimation(name: WeatherIconName): Promise<AnimationData | null> {
  const cached = animationRequests.get(name)
  if (cached) return cached

  const load = ANIMATIONS[pathFor(name)]
  const request = (load ? load() : Promise.resolve(null))
    .then((data) => (isAnimationData(data) ? data : null))
    .catch(() => {
      animationRequests.delete(name) // a failed fetch may succeed later (e.g. back online)
      return null
    })
  animationRequests.set(name, request)
  return request
}

let playerRequest: Promise<LottiePlayer | null> | null = null

/** The SVG-only "light" Lottie build (no expression engine, so no eval). Null if it cannot be loaded. */
export function loadLottiePlayer(): Promise<LottiePlayer | null> {
  playerRequest ??= import('lottie-web/build/player/lottie_light')
    .then((module) => module.default as LottiePlayer)
    .catch(() => {
      playerRequest = null
      return null
    })
  return playerRequest
}

/** Test seam: forget cached requests. */
export function resetWeatherAnimationCache(): void {
  animationRequests.clear()
  playerRequest = null
}
