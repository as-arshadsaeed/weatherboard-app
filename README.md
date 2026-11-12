# WeatherBoard App

A responsive, installable weather dashboard PWA: city search, current conditions, 5-day forecast,
favourite cities, offline access, daily reminders, light/dark themes and °C/°F.

> **Status: Phase 3 of 8 complete** (foundation, live weather, city search). Search any city,
> see real current conditions and a 5-day forecast. Favourites, units, detail cards, PWA/offline and
> notifications are not built yet — see [CLAUDE.md](CLAUDE.md) for the spec and phase plan. There is
> no mock weather data in the app.

## Requirements

- Node.js 20+ and npm

## Getting started

```bash
npm install
cp .env.example .env     # optional: add a GeoDB key (search works without one)
npm run dev              # http://localhost:5173
```

## Searching for a city

Type at least 2 characters in the header search. Suggestions (city, region, country; at most 6)
appear after a ~250 ms pause. Use **↑/↓** to move, **Enter** to select, **Esc** to close, or click/tap
a suggestion. Only suggested cities can be chosen; free text is never submitted. Selecting a city
loads its weather using the city's coordinates (and timezone when known).

| State                     | What you see                                                                 |
| ------------------------- | ---------------------------------------------------------------------------- |
| Empty field, then blur    | Inline error: "Enter a city name to search."                                 |
| 1 character               | Guidance: "Type at least 2 characters to search for a city."                 |
| Searching                 | "Searching…" with a spinner                                                  |
| No matches                | "No cities found. Try another spelling or search by country."                |
| Network failure           | "Unable to search cities. Check your internet connection and try again."     |
| Service problem / limits  | "City search is temporarily unavailable. Please try again." + **Try again**  |

### Providers

1. **GeoDB Cities** (RapidAPI) when `VITE_GEODB_API_KEY` is set.
2. **Open-Meteo geocoding** (free, no key) when there is no key, or automatically when GeoDB fails
   (network error, timeout, rate limit, outage or an unreadable response). An empty GeoDB result is
   treated as "no cities" and is not retried.

Recent successful searches are cached in memory (10 minutes, 50 searches).

> **GeoDB key security:** `VITE_*` variables are embedded in the public JavaScript bundle, so the key
> is **not secret**. In the RapidAPI dashboard restrict it (allowed domains/referrers) and set a quota.
> The free GeoDB plan allows roughly one request per second; the Open-Meteo fallback absorbs
> rate-limit errors. If you need the key to stay private, put a small server-side proxy in front
> of GeoDB (this would be a documented departure from the client-only design).
> GeoDB's live behaviour has not been verified in this repo (no key was available); the Open-Meteo path has.

### Deep link

A location can still be supplied in the URL as the initial city:

```text
http://localhost:5173/?lat=35.6762&lon=139.6503&name=Tokyo&country=Japan&region=Tokyo
```

`lat` (−90…90) and `lon` (−180…180) are required; `name`, `country`, `region` and `tz` (IANA timezone)
are optional. Invalid coordinates show "Weather data is unavailable for this location." and make no request.

## Weather data

Weather comes from the free, keyless [Open-Meteo](https://open-meteo.com/en/docs) forecast API
(`https://api.open-meteo.com/v1/forecast`), requested in °C and km/h with the city's timezone.
Requests time out after 10 s and are cancelled when superseded. Network failure, timeout, rate
limiting, service outage, invalid location and malformed responses each show a specific message
and (where retrying can help) a **Try again** button. Open-Meteo's data is licensed CC BY 4.0;
the app shows the required "Weather data by Open-Meteo.com" attribution.

## Scripts

| Command             | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start the Vite dev server                       |
| `npm run build`     | Type-check, then build to `dist/`               |
| `npm run preview`   | Serve the production build locally              |
| `npm run typecheck` | TypeScript (strict) check only                  |
| `npm run lint`      | ESLint                                          |
| `npm test`          | Unit/component tests (Vitest + Testing Library) |
| `npm run test:e2e`  | Playwright e2e against the production build     |

First e2e run needs a browser: `npx playwright install chromium`.

The e2e suite intercepts weather and geocoding requests (in the tests only) so loading, failure,
retry and fallback states are deterministic. It builds the app with a dummy
`VITE_GEODB_API_KEY=e2e-test-key` so the GeoDB path is exercised; a real key in `.env` is never used.
A separate opt-in test calls the **real** APIs (weather and keyless geocoding):

```bash
WEATHER_LIVE=1 npx playwright test e2e/weather-live.spec.ts --workers=1
```

## Environment variables

| Variable             | Required | Notes                                                                                      |
| -------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `VITE_GEODB_API_KEY` | No       | Enables GeoDB search. **Public once built** — restrict by domain and set a quota. Without it, search uses Open-Meteo geocoding. |

## Project structure

```text
src/
  components/{layout,weather,search,favourites,settings,ui}
  hooks/      useTheme, useWeather, useCitySearch (debounced, cancellable), useNow
  services/   weatherApi, citySearch (+ geoDbApi, openMeteoGeocodingApi, http), storageService
  types/      weather, city, preferences
  utils/      weatherCodes, temperature, date, validation, city, cn, constants
  styles/     globals.css  ← design tokens (light + dark)
e2e/          Playwright specs (responsive, a11y, theme, contrast, weather states, search)
```

## Design system

All colours, radii and shadows are semantic tokens in `src/styles/globals.css` (OKLCH, shadcn naming,
plus `--weather-*` accents). Components use utilities such as `bg-card` / `text-muted-foreground`,
never raw colours, so both themes stay consistent. Text/background token pairs are verified against
WCAG AA in `e2e/contrast.spec.ts`.
