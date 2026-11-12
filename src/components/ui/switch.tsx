import { cn } from '@/utils/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** id of the element that labels the switch. */
  labelledBy: string
  describedBy?: string
  className?: string
}

/**
 * An on/off switch (role="switch"). The hit area is 44 px tall; the state is shown by the knob's
 * position and a check mark / dash, not by colour alone. Native <button>, so Space and Enter both toggle.
 */
export function Switch({ checked, onCheckedChange, labelledBy, describedBy, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onCheckedChange(!checked)}
      className={cn('group inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full', className)}
    >
      <span
        className={cn(
          'relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-150',
          checked ? 'border-transparent bg-primary' : 'border-input bg-muted',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute grid size-5 place-items-center rounded-full bg-background text-[0.625rem] font-bold shadow-xs transition-transform duration-150',
            checked ? 'translate-x-[1.5rem] text-foreground' : 'translate-x-[0.25rem] text-muted-foreground',
          )}
        >
          {checked ? '✓' : '–'}
        </span>
      </span>
    </button>
  )
}
