/** Required attribution for Open-Meteo data (CC BY 4.0). */
export function WeatherAttribution() {
  return (
    <p className="text-xs text-muted-foreground">
      Weather data by{' '}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noopener noreferrer"
        // 44 px tall hit area; the negative margin keeps the line's layout height unchanged.
        className="-my-3.5 inline-flex min-h-11 items-center rounded-sm underline underline-offset-2 hover:text-foreground"
      >
        Open-Meteo.com
      </a>
    </p>
  )
}
