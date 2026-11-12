/** Required attribution for Open-Meteo data (CC BY 4.0). */
export function WeatherAttribution() {
  return (
    <p className="text-xs text-muted-foreground">
      Weather data by{' '}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-sm underline underline-offset-2 hover:text-foreground"
      >
        Open-Meteo.com
      </a>
    </p>
  )
}
