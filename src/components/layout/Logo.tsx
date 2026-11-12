import { cn } from '@/utils/cn'

/** WeatherBoard mark (sun behind a cloud) with wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={cn(
        'inline-flex max-w-full items-center gap-2.5 rounded-lg font-semibold tracking-tight',
        className,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] bg-primary text-primary-foreground shadow-xs">
        <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
          <circle cx="20.5" cy="12.5" r="5.5" fill="var(--weather-sun)" />
          <path
            d="M9.5 24.5a4.5 4.5 0 0 1-.6-8.96A6.5 6.5 0 0 1 21.4 17.1 3.7 3.7 0 0 1 21 24.5Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="min-w-0 text-[1.0625rem] [overflow-wrap:anywhere]">WeatherBoard</span>
    </a>
  )
}
