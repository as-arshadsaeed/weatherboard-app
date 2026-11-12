import { Skeleton } from '@/components/ui/skeleton'
import type { City } from '@/types/city'
import { formatLocation } from '@/utils/city'

/**
 * Loading placeholder with the same structure and heights as the loaded dashboard,
 * so nothing jumps when data arrives. Shows only what we genuinely know (the city name).
 */
export function WeatherSkeleton({
  city,
  reserveAction = false,
}: {
  city: City
  /** Reserve space for the action button the loaded card will show (e.g. "Add to favourites"). */
  reserveAction?: boolean
}) {
  const place = formatLocation(city)

  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">Loading weather for {city.name}…</span>

      <section className="rounded-2xl border bg-card p-6 shadow-card md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-3xl">
              {city.name}
            </h1>
            {place ? (
              <p className="mt-0.5 text-sm [overflow-wrap:anywhere] text-muted-foreground">{place}</p>
            ) : (
              <p className="mt-0.5 h-5" />
            )}
            <Skeleton className="mt-2.5 h-4 w-48" />
            {reserveAction && <Skeleton className="mt-3 h-11 w-40 rounded-lg md:h-9" />}
          </div>
          <Skeleton className="hidden size-20 rounded-3xl sm:block" />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <Skeleton className="size-20 rounded-3xl sm:hidden" />
          <div>
            <Skeleton className="h-[4.5rem] w-40 md:h-24 md:w-52" />
            <Skeleton className="mt-3 h-7 w-36" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
          ))}
        </div>
      </section>

      <div>
        <Skeleton className="mb-3 h-5 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="min-h-[6.5rem] rounded-2xl" />
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="mb-3 h-5 w-28" />
        <div className="grid gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="min-h-[5.5rem] rounded-2xl lg:min-h-[15rem]" />
          ))}
        </div>
      </div>

      <Skeleton className="h-4 w-44" />
    </div>
  )
}
