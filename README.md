# WeatherBoard App

A responsive, installable weather dashboard PWA: city search, current conditions, 5-day forecast,
favourite cities, offline access, daily reminders, light/dark themes and °C/°F.

> **Status: Phase 2 of 8 complete** (foundation + live weather). Real current conditions and a
> 5-day forecast from Open-Meteo are displayed for a location. City search, favourites, units,
> PWA/offline and notifications are not built yet — see [CLAUDE.md](CLAUDE.md) for the spec and
> phase plan. There is no mock weather data in the app.

## Requirements

- Node.js 20+ and npm

## Getting started

```bash
npm install
cp .env.example .env     # optional until Phase 3
npm run dev              # http://localhost:5173
```

## Viewing weather (until city search lands in Phase 3)

There is no search yet, so pass a location in the URL:

```text
http://localhost:5173/?lat=35.6762&lon=139.6503&name=Tokyo&country=Japan&region=Tokyo
```

| Parameter | Required | Notes                                                        |
| --------- | -------- | ------------------------------------------------------------ |
| `lat`     | yes      | −90 … 90                                                     |
| `lon`     | yes      | −180 … 180                                                   |
| `name`    | no       | Display name; defaults to the formatted coordinates          |
| `country` | no       | Shown under the name                                         |
| `region`  | no       | Shown under the name                                         |
| `tz`      | no       | IANA timezone (e.g. `Asia/Tokyo`); otherwise resolved by API |

Invalid coordinates show "Weather data is unavailable for this location." and make no request.

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

The e2e suite intercepts Open-Meteo requests (in the tests only) so loading, failure and retry
states are deterministic. A separate opt-in test calls the **real** API:

```bash
WEATHER_LIVE=1 npx playwright test e2e/weather-live.spec.ts --workers=1
```

## Environment variables

| Variable             | Required | Notes                                                                                      |
| -------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `VITE_GEODB_API_KEY` | Phase 3+ | **Public once built** — browser env vars are not secret. Restrict by domain and set quota. |

## Project structure

```text
src/
  components/{layout,weather,search,favourites,settings,ui}
  hooks/      useTheme, useWeather (race-safe loading), useNow
  services/   weatherApi (Open-Meteo), storageService (safe localStorage with in-memory fallback)
  types/      weather, city, preferences
  utils/      weatherCodes, temperature, date, validation, city, cn, constants
  styles/     globals.css  ← design tokens (light + dark)
e2e/          Playwright specs (responsive, a11y, theme, contrast, weather states)
```

## Design system

All colours, radii and shadows are semantic tokens in `src/styles/globals.css` (OKLCH, shadcn naming,
plus `--weather-*` accents). Components use utilities such as `bg-card` / `text-muted-foreground`,
never raw colours, so both themes stay consistent. Text/background token pairs are verified against
WCAG AA in `e2e/contrast.spec.ts`.
