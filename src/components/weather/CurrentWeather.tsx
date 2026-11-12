import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Thermometer } from 'lucide-react'

import { WeatherIcon } from '@/components/weather/WeatherIcon'
import { useNow } from '@/hooks/useNow'
import type { City } from '@/types/city'
import type { TemperatureUnit, WeatherReport } from '@/types/weather'
import { formatLocation } from '@/utils/city'
import { formatLocalDate, formatLocalTime } from '@/utils/date'
import { formatDegrees, formatTemperature, roundTemperature, temperatureUnitLetter } from '@/utils/temperature'
import { describeWeather } from '@/utils/weatherCodes'

interface CurrentWeatherProps {
  city: City
  report: WeatherReport
  unit: TemperatureUnit
}

function Stat({
  icon,
  label,
  value,
  accessibleValue,
}: {
  icon: ReactNode
  label: string
  value: string
  accessibleValue: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/60 px-3 py-3 sm:px-4">
      <dt className="flex items-center gap-1 text-xs whitespace-nowrap sm:gap-1.5 font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="tabular text-lg font-semibold tracking-tight" aria-label={accessibleValue}>
        {value}
      </dd>
    </div>
  )
}

export function CurrentWeather({ city, report, unit }: CurrentWeatherProps) {
  const now = useNow()
  const { current, timezone } = report
  const today = report.daily[0]
  const condition = describeWeather(current.weatherCode, current.isDay)
  const letter = temperatureUnitLetter(unit)
  const place = formatLocation(city)

  return (
    <section
      aria-labelledby="current-weather-heading"
      className="rounded-2xl border bg-card p-6 shadow-card md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            id="current-weather-heading"
            className="truncate text-2xl font-semibold tracking-tight md:text-3xl"
          >
            {city.name}
          </h1>
          {place && <p className="mt-0.5 truncate text-sm text-muted-foreground">{place}</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            <time dateTime={now.toISOString()}>
              {formatLocalDate(now, timezone)} · {formatLocalTime(now, timezone)}
            </time>{' '}
            <span className="text-muted-foreground/80">local time</span>
          </p>
        </div>
        <WeatherIcon
          code={current.weatherCode}
          isDay={current.isDay}
          size="lg"
          animated
          className="hidden sm:grid"
        />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <WeatherIcon
          code={current.weatherCode}
          isDay={current.isDay}
          size="lg"
          animated
          className="sm:hidden"
        />
        <div>
          <p
            className="tabular flex items-start text-7xl leading-none font-semibold tracking-tighter md:text-8xl"
            aria-label={`${roundTemperature(current.temperatureC, unit)} degrees ${unit === 'celsius' ? 'Celsius' : 'Fahrenheit'}`}
          >
            <span aria-hidden="true">{roundTemperature(current.temperatureC, unit)}</span>
            <span
              aria-hidden="true"
              className="mt-1 ml-1 text-3xl font-medium tracking-normal text-muted-foreground md:mt-2 md:text-4xl"
            >
              °{letter}
            </span>
          </p>
          <p className="mt-3 text-lg font-medium">{condition.label}</p>
        </div>
      </div>

      {today && (
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Stat
            icon={<Thermometer className="size-3.5" aria-hidden="true" />}
            label="Feels like"
            value={formatDegrees(current.apparentTemperatureC, unit)}
            accessibleValue={formatTemperature(current.apparentTemperatureC, unit)}
          />
          <Stat
            icon={<ArrowUp className="size-3.5" aria-hidden="true" />}
            label="High"
            value={formatDegrees(today.maxTemperatureC, unit)}
            accessibleValue={formatTemperature(today.maxTemperatureC, unit)}
          />
          <Stat
            icon={<ArrowDown className="size-3.5" aria-hidden="true" />}
            label="Low"
            value={formatDegrees(today.minTemperatureC, unit)}
            accessibleValue={formatTemperature(today.minTemperatureC, unit)}
          />
        </dl>
      )}
    </section>
  )
}
