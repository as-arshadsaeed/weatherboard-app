# WeatherBoard App

A responsive, installable weather dashboard PWA: city search, current conditions, 5-day forecast,
favourite cities, offline access, daily reminders, light/dark themes and °C/°F.

> **Status: Phase 5 of 8 complete** (foundation, live weather, city search, favourites and
> settings, installable PWA with offline weather). Notifications, polish and deployment are not built
> yet — see [CLAUDE.md](CLAUDE.md) for the spec and phase plan. There is no mock weather data in the app.

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

## Favourites, units and navigation

**Favourites** — press **Add to favourites** on the weather card (a filled star and the word
"Saved" show the state). Up to **5** cities; a sixth shows "Favourites are full (5 of 5)…". The same
city found through GeoDB and through Open-Meteo is recognised as one favourite (matched by id or by
coordinates within ~2 km). Pick a favourite in the panel to load its weather. **Removing always asks
first** (accessible confirmation dialog: Escape or "Keep" cancels; focus returns sensibly).

**Temperature unit** — the °C / °F control in the header. It converts everything on screen
immediately (current, feels-like, high/low, every forecast card), is remembered, and never refetches
(weather is always fetched in °C and converted in the browser). Wind stays in km/h.

**Detail cards** — humidity, wind speed, wind direction (compass point and bearing, the direction
the wind comes *from*), precipitation chance for today, sunrise and sunset in the city's local time.
Anything the API does not provide reads "Not available" instead of a guess.

**Navigation** — tablet and desktop show the favourites sidebar beside the weather. On phones a
bottom bar switches between **Weather** and **Favourites**; choosing a city returns you to the weather.

### What is saved, and what if storage is blocked

| localStorage key            | Contents                                   |
| --------------------------- | ------------------------------------------ |
| `weatherboard:favourites`   | Up to 5 saved cities                       |
| `weatherboard:selectedCity` | The city last shown (restored on reload)   |
| `weatherboard:unit`         | `celsius` or `fahrenheit`                  |
| `weatherboard:theme`        | `light` or `dark` (absent = follow the OS) |

Saved weather is not in localStorage: it is in the `weatherboard` IndexedDB database.

Stored values are validated: corrupt data is ignored, and a partly corrupted favourites list keeps
its valid entries. If the browser blocks local storage (e.g. some private modes), everything still works
for the session and a dismissible notice explains that favourites and settings will be lost when the tab
closes. Changes in one tab are not pushed to other open tabs.

## Installing and using it offline

WeatherBoard is an installable PWA (manifest, 192/512 and maskable icons, standalone display). Use your
browser's install option (for example the install icon in Chrome's address bar, or "Add to Home Screen").
Installing needs HTTPS (localhost is exempt) and a **production build**: the service worker is not
registered by `npm run dev`. Try it with `npm run build && npm run preview`.

**What works offline**

- The app itself opens offline, including deep links, once it has been loaded online one time.
- **Weather for cities you have viewed.** Each successful forecast is saved on your device (IndexedDB) for
  the last 10 cities, for up to 7 days. Offline, or when the weather service cannot be reached, you see
  that saved forecast **clearly labelled** — "Showing saved weather", when it was retrieved ("Fri 13 Nov,
  1:22 AM, about 3 hours ago") and that conditions may have changed.
- A city you have **not** viewed has no weather offline, and the app says so instead of guessing.
- City search needs a connection.

When the connection returns the weather refreshes by itself and the saved copy is replaced. Failed or
unreadable responses are never saved. Old data (over 7 days) and damaged records are discarded.

**Updates** — a new version downloads in the background and then waits. You are asked "A new version is
ready — Reload / Later"; nothing reloads unexpectedly, and your favourites, settings and saved weather are
kept. (The service worker deliberately does **not** cache weather: it would serve stale forecasts as if they
were live, so saved weather lives in the app with its age instead.)

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
  hooks/      useTheme, useUnits, useFavourites, useSelectedCity, useWeather, useOnlineStatus, useCitySearch, useNow
  services/   weatherApi, weatherCache (IndexedDB), citySearch (+ geoDbApi, openMeteoGeocodingApi, http), storageService
  pwa/        serviceWorker (registration + update state)
scripts/      generate-icons.mjs
  types/      weather, city, preferences
  utils/      weatherCodes, temperature, date, wind, validation, city, cn, constants
  styles/     globals.css  ← design tokens (light + dark)
e2e/          Playwright specs (responsive, a11y, theme, contrast, weather, search, units, favourites, navigation, pwa, offline)
```

## Design system

All colours, radii and shadows are semantic tokens in `src/styles/globals.css` (OKLCH, shadcn naming,
plus `--weather-*` accents). Components use utilities such as `bg-card` / `text-muted-foreground`,
never raw colours, so both themes stay consistent. Text/background token pairs are verified against
WCAG AA in `e2e/contrast.spec.ts`.
