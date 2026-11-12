import type { ReactNode } from 'react'
import { ArrowUp, Droplets, Sunrise, Sunset, Umbrella, Wind, Compass } from 'lucide-react'

import type { WeatherReport } from '@/types/weather'
import { UNAVAILABLE_TEXT } from '@/utils/constants'
import { formatLocalClock } from '@/utils/date'
import { degreesToCompass } from '@/utils/wind'

interface DetailCardProps {
  icon: ReactNode
  label: string
  /** Visible value, or null when the API did not provide one. */
  value: string | null
  /** Overrides the spoken value (e.g. to expand abbreviations). */
  spokenValue?: string
  note?: ReactNode
}

function DetailCard({ icon, label, value, spokenValue, note }: DetailCardProps) {
  return (
    <div className="flex min-h-[6.5rem] flex-col gap-2.5 rounded-2xl border bg-card p-4 shadow-card">
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0">
        {value === null ? (
          <span className="text-sm font-medium text-muted-foreground">{UNAVAILABLE_TEXT}</span>
        ) : (
          <span
            className="tabular block truncate text-xl font-semibold tracking-tight"
            aria-label={spokenValue}
          >
            {value}
          </span>
        )}
        {note && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  )
}

const ICON = 'size-3.5 shrink-0'

/** Today's conditions at the city: humidity, wind, precipitation chance, sunrise and sunset (city-local times). */
export function WeatherDetails({ report }: { report: WeatherReport }) {
  const { current } = report
  const today = report.daily[0]

  const humidity = current.humidityPercent
  const speed = current.windSpeedKmh
  const direction = current.windDirectionDegrees
  const compass = direction === null ? null : degreesToCompass(direction)
  const precipitation = today?.precipitationProbabilityPercent ?? null
  const sunrise = formatLocalClock(today?.sunrise ?? null)
  const sunset = formatLocalClock(today?.sunset ?? null)

  return (
    <section aria-labelledby="details-heading">
      <h2 id="details-heading" className="mb-3 text-sm font-semibold tracking-tight">
        Today&rsquo;s details
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DetailCard
          icon={<Droplets className={ICON} aria-hidden="true" />}
          label="Humidity"
          value={humidity === null ? null : `${Math.round(humidity)}%`}
          spokenValue={humidity === null ? undefined : `${Math.round(humidity)} percent`}
        />
        <DetailCard
          icon={<Wind className={ICON} aria-hidden="true" />}
          label="Wind speed"
          value={speed === null ? null : `${Math.round(speed)} km/h`}
          spokenValue={speed === null ? undefined : `${Math.round(speed)} kilometres per hour`}
        />
        <DetailCard
          icon={<Compass className={ICON} aria-hidden="true" />}
          label="Wind direction"
          value={compass === null || direction === null ? null : `From ${compass.short}`}
          spokenValue={
            compass === null || direction === null
              ? undefined
              : `From the ${compass.spoken}, ${Math.round(direction)} degrees`
          }
          note={
            direction === null ? undefined : (
              <span className="inline-flex items-center gap-1">
                <ArrowUp
                  className="size-3"
                  style={{ transform: `rotate(${direction + 180}deg)` }}
                  aria-hidden="true"
                />
                {Math.round(direction)}°
              </span>
            )
          }
        />
        <DetailCard
          icon={<Umbrella className={ICON} aria-hidden="true" />}
          label="Precipitation"
          value={precipitation === null ? null : `${Math.round(precipitation)}%`}
          spokenValue={
            precipitation === null ? undefined : `${Math.round(precipitation)} percent chance`
          }
          note={precipitation === null ? undefined : 'Chance today'}
        />
        <DetailCard
          icon={<Sunrise className={ICON} aria-hidden="true" />}
          label="Sunrise"
          value={sunrise}
          note={sunrise === null ? undefined : 'Local time'}
        />
        <DetailCard
          icon={<Sunset className={ICON} aria-hidden="true" />}
          label="Sunset"
          value={sunset}
          note={sunset === null ? undefined : 'Local time'}
        />
      </dl>
    </section>
  )
}
