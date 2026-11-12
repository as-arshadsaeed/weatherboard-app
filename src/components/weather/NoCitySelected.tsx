import { CloudSun } from 'lucide-react'

/** Dashboard empty state shown while no city has been chosen. */
export function NoCitySelected() {
  return (
    <section className="relative isolate flex min-h-[26rem] flex-col items-center justify-center overflow-hidden rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
      {/* Faint dot grid that fades towards the edges */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [background-image:radial-gradient(var(--border)_1.25px,transparent_1.25px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
      />
      <div className="grid size-14 place-items-center rounded-2xl border bg-background text-brand shadow-raised">
        <CloudSun className="size-7" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        No city selected
      </h1>
      <p className="mt-2 max-w-sm text-base text-balance text-muted-foreground">
        Choose a city to see its current conditions and five-day forecast here.
      </p>
    </section>
  )
}
