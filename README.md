# WeatherBoard App

A responsive, installable weather dashboard PWA: city search, current conditions, 5-day forecast,
favourite cities, offline access, daily reminders, light/dark themes and °C/°F.

> **Status: Phase 1 of 8 complete (foundation + dashboard shell).** Weather data, city search,
> favourites, units, PWA/offline and notifications are not built yet — see [CLAUDE.md](CLAUDE.md)
> for the spec and phase plan. The UI shows honest empty states; there is no mock weather data.

## Requirements

- Node.js 20+ and npm

## Getting started

```bash
npm install
cp .env.example .env     # optional until Phase 3
npm run dev              # http://localhost:5173
```

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

## Environment variables

| Variable             | Required | Notes                                                                                      |
| -------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `VITE_GEODB_API_KEY` | Phase 3+ | **Public once built** — browser env vars are not secret. Restrict by domain and set quota. |

## Project structure

```text
src/
  components/{layout,weather,search,favourites,settings,ui}
  hooks/      useTheme
  services/   storageService (safe localStorage with in-memory fallback)
  types/      preferences
  utils/      cn, constants
  styles/     globals.css  ← design tokens (light + dark)
e2e/          Playwright specs (responsive, a11y, theme, contrast)
```

## Design system

All colours, radii and shadows are semantic tokens in `src/styles/globals.css` (OKLCH, shadcn naming,
plus `--weather-*` accents). Components use utilities such as `bg-card` / `text-muted-foreground`,
never raw colours, so both themes stay consistent. Text/background token pairs are verified against
WCAG AA in `e2e/contrast.spec.ts`.
