/** WMO weather interpretation codes as used by Open-Meteo, mapped to readable text and an icon key. */

export type WeatherIconName =
  | 'sun'
  | 'moon'
  | 'cloud-sun'
  | 'cloud-moon'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'snow'
  | 'snowflake'
  | 'thunderstorm'
  | 'hail'

/** Drives the accent colour token; never the only signal (a text description always accompanies it). */
export type WeatherTone = 'sun' | 'night' | 'cloud' | 'rain' | 'snow' | 'storm'

export interface WeatherDescription {
  label: string
  icon: WeatherIconName
  tone: WeatherTone
}

type CodeEntry = { label: string; day: WeatherIconName; night?: WeatherIconName; tone: WeatherTone }

const CODES: Record<number, CodeEntry> = {
  0: { label: 'Clear sky', day: 'sun', night: 'moon', tone: 'sun' },
  1: { label: 'Mainly clear', day: 'sun', night: 'moon', tone: 'sun' },
  2: { label: 'Partly cloudy', day: 'cloud-sun', night: 'cloud-moon', tone: 'cloud' },
  3: { label: 'Overcast', day: 'cloud', tone: 'cloud' },
  45: { label: 'Fog', day: 'fog', tone: 'cloud' },
  48: { label: 'Freezing fog', day: 'fog', tone: 'cloud' },
  51: { label: 'Light drizzle', day: 'drizzle', tone: 'rain' },
  53: { label: 'Moderate drizzle', day: 'drizzle', tone: 'rain' },
  55: { label: 'Dense drizzle', day: 'drizzle', tone: 'rain' },
  56: { label: 'Light freezing drizzle', day: 'drizzle', tone: 'rain' },
  57: { label: 'Dense freezing drizzle', day: 'drizzle', tone: 'rain' },
  61: { label: 'Light rain', day: 'rain', tone: 'rain' },
  63: { label: 'Moderate rain', day: 'rain', tone: 'rain' },
  65: { label: 'Heavy rain', day: 'heavy-rain', tone: 'rain' },
  66: { label: 'Light freezing rain', day: 'rain', tone: 'rain' },
  67: { label: 'Heavy freezing rain', day: 'heavy-rain', tone: 'rain' },
  71: { label: 'Light snow', day: 'snow', tone: 'snow' },
  73: { label: 'Moderate snow', day: 'snow', tone: 'snow' },
  75: { label: 'Heavy snow', day: 'snow', tone: 'snow' },
  77: { label: 'Snow grains', day: 'snowflake', tone: 'snow' },
  80: { label: 'Light rain showers', day: 'rain', tone: 'rain' },
  81: { label: 'Moderate rain showers', day: 'rain', tone: 'rain' },
  82: { label: 'Violent rain showers', day: 'heavy-rain', tone: 'rain' },
  85: { label: 'Light snow showers', day: 'snow', tone: 'snow' },
  86: { label: 'Heavy snow showers', day: 'snow', tone: 'snow' },
  95: { label: 'Thunderstorm', day: 'thunderstorm', tone: 'storm' },
  96: { label: 'Thunderstorm with light hail', day: 'hail', tone: 'storm' },
  99: { label: 'Thunderstorm with heavy hail', day: 'hail', tone: 'storm' },
}

export function describeWeather(code: number, isDay = true): WeatherDescription {
  const entry = CODES[code]
  if (!entry) return { label: 'Unknown conditions', icon: 'cloud', tone: 'cloud' }

  const icon = !isDay && entry.night ? entry.night : entry.day
  // Clear nights read as "night" rather than "sun" colour.
  const tone: WeatherTone = !isDay && entry.tone === 'sun' ? 'night' : entry.tone
  return { label: entry.label, icon, tone }
}
