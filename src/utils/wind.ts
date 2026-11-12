const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const

const SPOKEN: Record<(typeof POINTS)[number], string> = {
  N: 'north',
  NNE: 'north-north-east',
  NE: 'north-east',
  ENE: 'east-north-east',
  E: 'east',
  ESE: 'east-south-east',
  SE: 'south-east',
  SSE: 'south-south-east',
  S: 'south',
  SSW: 'south-south-west',
  SW: 'south-west',
  WSW: 'west-south-west',
  W: 'west',
  WNW: 'west-north-west',
  NW: 'north-west',
  NNW: 'north-north-west',
}

export interface CompassDirection {
  /** e.g. "NNW" */
  short: string
  /** e.g. "north-north-west", for assistive technology */
  spoken: string
}

/** 16-point compass name for a bearing in degrees. Out-of-range and negative bearings wrap. */
export function degreesToCompass(degrees: number): CompassDirection {
  const normalised = ((degrees % 360) + 360) % 360
  const short = POINTS[Math.round(normalised / 22.5) % 16] ?? 'N'
  return { short, spoken: SPOKEN[short] }
}
