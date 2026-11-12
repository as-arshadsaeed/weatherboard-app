import { Droplets } from 'lucide-react'

import { WeatherIcon } from '@/components/weather/WeatherIcon'
import type { DailyForecast, TemperatureUnit } from '@/types/weather'
import { formatForecastDay, formatForecastDayLong, formatForecastShortDate } from '@/utils/date'
import { formatDegrees, formatTemperature } from '@/utils/temperature'
import { describeWeather } from '@/utils/weatherCodes'

interface ForecastCardProps {
  day: DailyForecast
  index: number
  unit: TemperatureUnit
}

/** One forecast day. A compact row on narrow layouts, a vertical card from `lg` up. */
export function ForecastCard({ day, index, unit }: ForecastCardProps) {
  const condition = describeWeather(day.weatherCode, true)
  const precipitation = day.precipitationProbabilityPercent
  const precipitationLabel =
    precipitation === null
      ? 'Chance of precipitation not available'
      : `${Math.round(precipitation)} percent chance of precipitation`

  return (
    <li
      aria-label={formatForecastDayLong(day.date, index)}
      className="flex min-h-[5.5rem] flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-4 shadow-card lg:min-h-[15rem] lg:flex-col lg:flex-nowrap lg:justify-between lg:gap-3 lg:text-center"
    >
      <div className="w-16 shrink-0 lg:w-auto">
        <p className="text-sm font-semibold">{formatForecastDay(day.date, index)}</p>
        <p className="text-xs text-muted-foreground">{formatForecastShortDate(day.date)}</p>
      </div>

      <div className="flex min-w-24 flex-1 items-center gap-3 lg:min-w-0 lg:flex-none lg:flex-col">
        <WeatherIcon code={day.weatherCode} size="sm" />
        <p className="min-w-0 text-sm text-balance text-muted-foreground [overflow-wrap:anywhere] lg:min-h-10">
          {condition.label}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 lg:items-center">
        <p className="tabular flex items-baseline gap-1.5">
          <span className="sr-only">{`High ${formatTemperature(day.maxTemperatureC, unit)}, low ${formatTemperature(day.minTemperatureC, unit)}`}</span>
          <span aria-hidden="true" className="text-lg font-semibold">
            {formatDegrees(day.maxTemperatureC, unit)}
          </span>
          <span aria-hidden="true" className="text-sm text-muted-foreground">
            {formatDegrees(day.minTemperatureC, unit)}
          </span>
        </p>
        <p className="tabular flex items-center gap-1 text-xs text-muted-foreground">
          <span className="sr-only">{precipitationLabel}</span>
          <Droplets className="size-3.5" aria-hidden="true" />
          <span aria-hidden="true">{precipitation === null ? '–' : `${Math.round(precipitation)}%`}</span>
        </p>
      </div>
    </li>
  )
}
