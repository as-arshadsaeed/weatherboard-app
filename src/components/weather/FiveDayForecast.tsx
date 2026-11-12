import { ForecastCard } from '@/components/weather/ForecastCard'
import type { DailyForecast, TemperatureUnit } from '@/types/weather'

interface FiveDayForecastProps {
  days: readonly DailyForecast[]
  unit: TemperatureUnit
}

export function FiveDayForecast({ days, unit }: FiveDayForecastProps) {
  return (
    <section aria-labelledby="forecast-heading">
      <h2 id="forecast-heading" className="mb-3 text-sm font-semibold tracking-tight">
        5-day forecast
      </h2>
      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {days.map((day, index) => (
          <ForecastCard key={day.date} day={day} index={index} unit={unit} />
        ))}
      </ol>
    </section>
  )
}
