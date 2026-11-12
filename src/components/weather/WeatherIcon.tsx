import { useState } from 'react'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  type LucideIcon,
} from 'lucide-react'

import { WeatherAnimation } from '@/components/weather/WeatherAnimation'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { hasWeatherAnimation } from '@/services/weatherAnimations'
import { describeWeather, type WeatherIconName, type WeatherTone } from '@/utils/weatherCodes'
import { cn } from '@/utils/cn'

const ICONS: Record<WeatherIconName, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  'cloud-sun': CloudSun,
  'cloud-moon': CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  'heavy-rain': CloudRainWind,
  snow: CloudSnow,
  snowflake: Snowflake,
  thunderstorm: CloudLightning,
  hail: CloudHail,
}

// Full class names so Tailwind can detect them. Colour reinforces, never replaces, the text label.
const TONES: Record<WeatherTone, string> = {
  sun: 'bg-weather-sun/15 text-weather-sun',
  night: 'bg-weather-night/15 text-weather-night',
  cloud: 'bg-weather-cloud/15 text-weather-cloud',
  rain: 'bg-weather-rain/15 text-weather-rain',
  snow: 'bg-weather-snow/20 text-weather-snow',
  storm: 'bg-weather-storm/15 text-weather-storm',
}

// The animation is drawn a little larger than the static glyph: its artwork has built-in padding.
const SIZES = {
  sm: { tile: 'size-11 rounded-xl', icon: 'size-6', animation: 'size-9' },
  lg: { tile: 'size-20 rounded-3xl', icon: 'size-11', animation: 'size-16' },
} as const

interface WeatherIconProps {
  code: number
  isDay?: boolean
  size?: keyof typeof SIZES
  /** Show the Lottie animation. Always off for users who prefer reduced motion. Defaults to on. */
  animated?: boolean
  className?: string
}

/**
 * Decorative weather glyph; the condition is always also stated in text next to it, so the whole thing is
 * hidden from assistive technology. The tile has a fixed size and the static icon is drawn first, so nothing
 * shifts while the animation loads, and it stays as the fallback if the animation cannot be shown.
 */
export function WeatherIcon({
  code,
  isDay = true,
  size = 'sm',
  animated = true,
  className,
}: WeatherIconProps) {
  const { icon, tone } = describeWeather(code, isDay)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const showAnimation = animated && !prefersReducedMotion && hasWeatherAnimation(icon)

  return (
    <span
      aria-hidden="true"
      data-weather-icon={icon}
      className={cn('grid shrink-0 place-items-center', SIZES[size].tile, TONES[tone], className)}
    >
      {/* Keyed by icon so a new condition starts again from the static glyph. */}
      {showAnimation ? (
        <AnimatedGlyph key={icon} name={icon} size={size} />
      ) : (
        <StaticGlyph name={icon} size={size} />
      )}
    </span>
  )
}

function StaticGlyph({ name, size, hidden = false }: { name: WeatherIconName; size: keyof typeof SIZES; hidden?: boolean }) {
  const Icon = ICONS[name]
  return <Icon className={cn(SIZES[size].icon, hidden && 'hidden')} strokeWidth={1.75} />
}

/** Static glyph until the animation is on screen; back to the glyph if it fails. */
function AnimatedGlyph({ name, size }: { name: WeatherIconName; size: keyof typeof SIZES }) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <StaticGlyph name={name} size={size} hidden={shown} />
      <WeatherAnimation name={name} onStatusChange={setShown} className={cn(SIZES[size].animation, !shown && 'hidden')} />
    </>
  )
}
