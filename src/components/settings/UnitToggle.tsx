import { Button } from '@/components/ui/button'
import type { TemperatureUnit } from '@/types/weather'
import { cn } from '@/utils/cn'

const OPTIONS: ReadonlyArray<{ unit: TemperatureUnit; label: string; accessibleName: string }> = [
  { unit: 'celsius', label: '°C', accessibleName: 'Celsius (°C)' },
  { unit: 'fahrenheit', label: '°F', accessibleName: 'Fahrenheit (°F)' },
]

interface UnitToggleProps {
  unit: TemperatureUnit
  onChange: (unit: TemperatureUnit) => void
}

/** Segmented °C / °F control. Each button is a toggle (aria-pressed); the pressed one is also visually filled. */
export function UnitToggle({ unit, onChange }: UnitToggleProps) {
  return (
    <div
      role="group"
      aria-label="Temperature unit"
      className="inline-flex items-center overflow-hidden rounded-lg border border-input bg-card shadow-xs"
    >
      {OPTIONS.map((option) => {
        const pressed = option.unit === unit
        return (
          <Button
            key={option.unit}
            variant="ghost"
            size="icon"
            aria-pressed={pressed}
            aria-label={option.accessibleName}
            onClick={() => onChange(option.unit)}
            className={cn(
              'rounded-none text-sm font-semibold md:size-10',
              pressed
                ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                : 'text-muted-foreground',
            )}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
