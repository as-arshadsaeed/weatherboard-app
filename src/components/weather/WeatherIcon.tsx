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

const SIZES = {
  sm: { tile: 'size-11 rounded-xl', icon: 'size-6' },
  lg: { tile: 'size-20 rounded-3xl', icon: 'size-11' },
} as const

interface WeatherIconProps {
  code: number
  isDay?: boolean
  size?: keyof typeof SIZES
  /** Gentle CSS motion; automatically disabled for users who prefer reduced motion. */
  animated?: boolean
  className?: string
}

/** Decorative weather glyph. The condition is always also stated in text next to it. */
export function WeatherIcon({
  code,
  isDay = true,
  size = 'sm',
  animated = false,
  className,
}: WeatherIconProps) {
  const { icon, tone } = describeWeather(code, isDay)
  const Icon = ICONS[icon]
  const motion = animated ? (icon === 'sun' ? 'animate-weather-spin' : 'animate-weather-float') : ''

  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center', SIZES[size].tile, TONES[tone], className)}
    >
      <Icon className={cn(SIZES[size].icon, motion)} strokeWidth={1.75} />
    </span>
  )
}
