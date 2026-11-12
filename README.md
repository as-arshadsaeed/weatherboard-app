# WeatherBoard App

A responsive, installable weather dashboard PWA: city search, current conditions, 5-day forecast,
favourite cities, offline access, daily reminders, light/dark themes and °C/°F.

> **Status: Phase 6 of 8 complete** (foundation, live weather, city search, favourites and settings,
> installable PWA with offline weather, daily reminders). Polish and deployment are not built yet — see
> [CLAUDE.md](CLAUDE.md) for the spec and phase plan. There is no mock weather data in the app.

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
| `weatherboard:reminder`     | `{ enabled, time: "HH:mm", lastFiredOn }`     |

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

## Daily weather reminders

Open **Settings** (the gear in the header on tablet and desktop; the **Settings** tab at the bottom on
phones) to turn on a daily morning reminder.

- **Switch** the reminder on or off, and choose a **time** between 5:00 AM and 11:59 AM. An invalid or empty
  time is rejected with a message and is not saved. Your choices are remembered.
- The reminder shows the weather for **the city you are viewing when it fires**, in **your selected unit**
  (for example "Partly cloudy, 7°C, feels like 3°C. Today: high 8°C, low 5°C, 0% chance of precipitation.").
  If the forecast can't be fetched it uses your saved forecast and says so; if there is none it does not invent
  weather.
- **Permission.** Turning the reminder on shows: "We'd like to send you a daily morning reminder to check your
  local weather, so you can plan your day." The browser is asked **only when you press "Allow notifications"** —
  never on page load, never when you open Settings, never just because you turned the reminder on. Allowed,
  blocked (with how to change it), not asked yet, and "not supported" each have a clear message, and the reminder
  still appears inside WeatherBoard in all of them. A denied or unsupported browser never affects the dashboard.
- **How a reminder arrives.** It always appears as a banner inside WeatherBoard. If notifications are allowed and
  the app is open in a background tab or window, it also becomes a system notification (clicking it brings
  WeatherBoard to the front). "Send a test reminder" shows exactly what one looks like.

### Reminders only work while WeatherBoard is open

This version is client-side only, so **a reminder can only appear while WeatherBoard is open** in a browser tab
or an installed app window. It **cannot** send a reminder when the browser or app is closed, and nothing in the
page or its service worker can change that. If the app isn't open at your reminder time, or within 30 minutes
after it, you won't get that day's reminder: it is skipped, never sent late. (The check runs every 30 seconds
and again when the tab regains focus, becomes visible or comes back online, because background tabs are
throttled and laptops sleep.)

### What real background notifications would need

Delivering a reminder to a closed browser requires **Web Push**, which needs infrastructure this project
deliberately does not have yet:

1. **A push subscription** per device, created in the browser with `registration.pushManager.subscribe()`.
2. **A VAPID key pair**: the public key goes in the app; the private key must stay secret on a server (it
   cannot live in a client bundle).
3. **A push service**, which is the browser vendor's (Google, Mozilla or Apple) and is reached through the
   subscription's endpoint.
4. **A server-side sender** that signs and sends each message (for example the `web-push` library).
5. **Subscription storage** keyed to the user, with their chosen time, timezone, city and unit, plus handling of
   expired subscriptions (the push service answers 404/410).
6. **A scheduled job** that runs often enough (for example every few minutes) to find users whose local
   reminder time has arrived and send their message.
7. **A `push` event handler** in the service worker to show the notification (this build already handles
   `notificationclick`). On iOS this also needs the app to be installed to the Home Screen.

The code is organised so this can be added without rewriting the UI: scheduling, message building and delivery
are separate (`utils/reminder.ts`, `hooks/useReminders.ts`, `services/notificationService.ts`), and the
settings copy is driven by `REMINDER_DELIVERY` (`{ kind: 'in-app', backgroundDelivery: false }`). A push provider
would set `backgroundDelivery: true`, replace the in-app scheduler with a subscribe/sync call, and the wording in
Settings would follow. **No backend has been added.** Introducing one is a real architectural change (hosting,
a database, secrets, a scheduler, privacy for stored city and time), so please discuss the shape of it first.

> Testing note: headless Chromium reports notification permission as "denied" even when granted, so the final
> operating-system popup cannot be automated. The tests verify the call made on the real service worker
> registration (title, body, tag, icon) and every decision around it; checking the popup itself needs a manual
> look in a normal browser window.

## Accessibility and responsive layout

WeatherBoard targets WCAG 2.2 AA. What is built, and how it is checked:

- **Layouts** — phone (375 px), tablet (768 px) and desktop (1280 px), down to 320 px wide and 200 % text
  without horizontal scrolling or cut-off content. Long city names wrap rather than being truncated.
- **Landmarks and headings** — one `main`, one banner and one level-one heading on every screen, including
  the phone Favourites view. The page title follows the selected city.
- **Screen readers** — temperatures and other values are real (visually hidden) text, not `aria-label`s on
  generic elements. A polite live region announces new weather ("Weather for London: Partly cloudy, 7°C.")
  and unit changes; search results, errors and the offline/update banners announce themselves.
- **Keyboard** — every control is reachable in visual order with a visible focus ring that is never clipped
  and never hidden behind the sticky header or the bottom tab bar (`scroll-padding`). A skip link jumps to
  the weather.
- **Touch targets** — at least 44 × 44 px on phones, including the logo, the attribution link and the skip
  link once focused.
- **Short screens** — on a landscape phone the header scrolls away instead of staying pinned; dialogs scroll
  inside themselves, and the page behind an open dialog is locked.
- **Reduced motion** — with `prefers-reduced-motion` nothing animates or transitions, and the animated
  weather icons are not even downloaded (see below).
- **Themes** — both themes pass the axe scans and the token-contrast tests.

Automated checks (all in `e2e/`, run against the production build): `a11y-axe` (axe-core, WCAG 2.0–2.2
A/AA and best practice, on 18 screen states at 375/768/1280 px in light and dark), `a11y-structure`,
`a11y-targets`, `a11y-focus`, `a11y-motion`, `layout-short` (landscape phone, 320 × 240 window, scroll lock)
and `reflow` (320 px, 200 % text, text spacing, long names).

**What this does not prove.** Automated tools find only a fraction of accessibility problems. Nothing here
was tested with a real screen reader (VoiceOver, TalkBack, NVDA), on a physical phone, in Safari/iOS or in
Firefox: the e2e suite runs in Chromium only. Native modal dialogs do not wrap Tab inside the dialog, so
focus can reach the browser's own controls (the page behind stays inert).

## Animated weather icons

The current conditions and each forecast day show an animated icon (sun, moon, clouds, fog, drizzle, rain,
heavy rain, snow, snowfall, thunderstorm, hail; day and night variants).

- **Library** — [`lottie-web`](https://github.com/airbnb/lottie-web) 5.13.0 (MIT, pinned), using only its
  SVG-only **light** build: no expression engine, so no `eval`.
- **Artwork and licence** — all 13 animations are original. They are drawn from simple shapes by
  `scripts/generate-lottie.mjs` (`npm run lottie`) and committed to `src/assets/lottie/`. No third-party
  animation files are used, so there is no external asset licence to track; they are covered by this
  project's own licence.
- **Theming** — layers carry a class (`wb-sun`, `wb-cloud`, …) and `globals.css` maps it to the
  `--weather-*` design tokens, so one asset follows light and dark mode.
- **Loading** — the player (~47 KB gzip) and each animation (0.4–1.4 KB gzip) are separate lazy chunks; the
  main bundle grew by about 1 KB gzip. They are precached by the service worker, so the icons also animate
  offline. That adds 14 files (the player and 13 animations; about 250 KB, ~60 KB compressed) to the one-time background precache.
- **No layout shift** — the icon tile has a fixed size and shows the static icon first; the animation
  replaces it only once it is on screen.
- **Fallbacks** — if the player or an animation is missing, corrupt or fails, the static icon stays and
  nothing is logged as an error. Animation data is validated before use.
- **Reduced motion** — respected live. With the preference on, no animation is loaded or drawn; switching it
  on while the app is open removes them.
- **Cost** — animations play only while on screen and while the tab is visible, and are destroyed when
  removed.
- **Accessibility** — decorative: the tile is `aria-hidden`, nothing in it is focusable and it has no name,
  so screen readers announce nothing extra. The condition is always written next to it ("Partly cloudy").
- Navigation, settings and control icons are deliberately **not** animated.

## Weather data

Weather comes from the free, keyless [Open-Meteo](https://open-meteo.com/en/docs) forecast API
(`https://api.open-meteo.com/v1/forecast`), requested in °C and km/h with the city's timezone.
Requests time out after 10 s and are cancelled when superseded. Network failure, timeout, rate
limiting, service outage, invalid location and malformed responses each show a specific message
and (where retrying can help) a **Try again** button. Open-Meteo's data is licensed CC BY 4.0;
the app shows the required "Weather data by Open-Meteo.com" attribution.

## Deploying to Vercel

WeatherBoard is already deployed on Vercel from this GitHub repository. This section documents how the
deployment is meant to work. **How each statement was established is stated explicitly**: "verified here"
means checked against the code or a local production build; "Vercel docs" means taken from Vercel's
documentation; "check in the dashboard" means it lives in your Vercel project settings, which could not be
inspected from this repository and needs a look from you.

### Build settings

| Setting | Expected value | Status |
| --- | --- | --- |
| Framework preset | Vite (auto-detected) | Check in the dashboard |
| Build command | `npm run build` (`tsc -b && vite build`) | Script verified here; confirm the dashboard does not override it |
| Output directory | `dist` | Vite's default, verified here (`dist/index.html`, `dist/assets/`) |
| Install command | default (`npm install`) | Check in the dashboard |
| Node.js version | 20.19 or newer, or 22.12+ (Vite 8's requirement) | Builds verified here on Node 20.20.2; **check the project's Node version in the dashboard** |
| Production branch | the branch you intend to serve | **Check in the dashboard** (Settings → Git). Vercel's default is the repository's default branch; here `main` holds only the initial README commit, so confirm which branch production really deploys |
| Deployment Protection | your choice | Check in the dashboard. Vercel docs: new projects protect previews with Vercel Authentication, production stays public |

`vercel.json` deliberately contains **headers only**. It does not restate the build command or output
directory (a duplicate could conflict with the dashboard) and has **no rewrites**. WeatherBoard has a single
route, `/` (all state is in the query string), so there is no client-side route that needs an SPA fallback:
direct navigation and refresh of `/` and `/?lat=…&lon=…` work (verified here), and when offline the service
worker's `navigateFallback` serves the app shell. Vercel applies rewrites only after a filesystem match
(Vercel docs), so a catch-all would also turn missing assets into `200 index.html` and could capture
Vercel's own analytics endpoints. Unknown paths therefore return a plain 404, which is intended. If you later
add client-side routes, add a narrow rewrite for them and update `scripts/check-deployment.mjs`.

### Branches: preview and production

Per Vercel's docs: a push to the production branch creates a **production** deployment and updates your
production domains; a push to any other branch, or a pull request, creates a **preview** deployment with its
own URL, using your **Preview** environment variables. Pushing is what triggers a deployment, so nothing in
this repository deploys by itself, and the project's rule is that pushes and merges are made by you.
Previews are normally behind Vercel Authentication, so an unauthenticated tool (including
`npm run check:deployment`) sees a login page unless protection is off for that preview.

### Environment variables

| Variable | Required | Environment | Notes |
| --- | --- | --- | --- |
| `VITE_GEODB_API_KEY` | No | Production (and Preview if you want GeoDB there) | Enables GeoDB search. Without it, or if GeoDB fails or rate-limits, search uses the keyless Open-Meteo geocoding API. |
| `VITE_ANALYTICS` | No | **Production only** | `on` enables Vercel Web Analytics (see below). Unset = off. Ignored by builds Vercel labels preview or development. |

**Every `VITE_*` value is compiled into the JavaScript that every visitor downloads. It is public, not
secret. Never put a private credential in one.** The GeoDB key is therefore a *public* key: restrict it
in the RapidAPI/GeoDB dashboard with whatever limits your plan offers (at the least a usage quota, and a
domain or referrer restriction if available; which restrictions RapidAPI supports was not verified) and
treat it as exposed. `.env` is git-ignored; `.env.example` lists the variables. Changing a variable in
Vercel affects only **new** deployments (Vercel docs), so redeploy afterwards. `VERCEL_ENV` is read at build
time if Vercel exposes it to the build; you do not set it.

Weather needs no key: `https://api.open-meteo.com/v1/forecast` and `https://geocoding-api.open-meteo.com/v1/search`
are keyless and verified in the code (the live-API tests are opt-in: `WEATHER_LIVE=1`). Open-Meteo's terms and
usage limits for your kind of site (for example commercial use) were not reviewed here; read them before relying on the free API.

### HTTP headers and caching

| Path | `Cache-Control` | Why |
| --- | --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` | Vite content-hashes every file name; a changed file gets a new URL. `e2e/deployment.spec.ts` fails if anything unhashed ever lands in `/assets`. |
| `/`, `/index.html` | `public, max-age=0, must-revalidate` | The shell must always point at the current hashed assets. |
| `/sw.js`, `/sw-notifications.js` | `public, max-age=0, must-revalidate` | The service worker (and the script it imports) must be re-checked, or updates reach users late. |
| `/manifest.webmanifest` | same, plus `Content-Type: application/manifest+json` | Revalidated; correct MIME type. |
| everything else (icons, favicon) | Vercel's default | Not hashed, so never immutable. |

All responses also get `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY` and a restrictive `Permissions-Policy` (camera, microphone, geolocation, payment
off). Vercel serves the site over HTTPS; transport-security headers such as HSTS are not configured here and were not checked. **No Content-Security-Policy is set**: a
policy has to allow the weather and geocoding hosts, the inline pre-paint theme script, the SVG styles Lottie
writes and Vercel's analytics script, and a wrong one would break the live site; it could not be validated
against Vercel from here, so it is a recommended follow-up, not something to add blind.

The service worker does not cache weather (or any API) and has no runtime caches: it only precaches the
content-hashed app files, so there is no conflict between its caching and these headers. Weather lives in
IndexedDB with its age.

**What was verified, and how.** The rules were checked by applying `vercel.json` to every file of the real
build with a local simulation of Vercel's matching (`e2e/support/vercelSim.ts`), and by loading that build in
a browser with the service worker, going offline and reloading. That proves the rules and the build agree.
It is **not** a check of Vercel's edge: confirm the live headers with the checklist below.

### Updates, rollback and the service worker

A new deployment ships a new `sw.js`. Because it always revalidates, returning visitors' browsers find it,
install it in the background and show **"A new version is ready — Reload / Later"**; nothing reloads by itself
and saved cities, settings and saved weather are untouched. Hashed assets of older deployments are not
guaranteed to exist after a deploy, so an old open tab may fail to fetch a *changed* lazy chunk: for the
animations that simply means the static icon stays. (Vercel offers Skew Protection to keep old assets
available; it is a project setting whose availability on your plan was not checked.)

**Rollback** (Vercel docs): project overview → Production Deployment → **Instant Rollback**, then pick a
previous production deployment (Hobby: the immediately previous one; Pro/Enterprise: any earlier production
deployment). It does not rebuild; environment variables are **not** rolled back; and afterwards Vercel turns
off auto-assignment of production domains, so new pushes to the production branch will not go live until you
use **Manage → promote** (or `vercel promote`). Visitors receive a rolled-back version through the same
"new version" prompt. One caveat: if a future release bumps the IndexedDB schema version, a rollback to a
build with a lower version cannot open the newer database; the app tolerates a database that fails to open
(it shows no saved weather) but plan schema changes with that in mind. The schema has been at version 1
since it was introduced.

### Production smoke-test checklist

Run it against a preview URL first (with protection off or with a Shareable Link), then production.

1. `npm run check:deployment -- https://your-site` — read-only GET checks of status codes, content types,
   cache headers, security headers, the manifest and its icons, and that the worker has no weather URLs.
   It exits non-zero on any failure. (Verified here against the simulation; **not yet run against the live
   site**.)
2. Open the site in a fresh browser profile: it loads over **HTTPS**, shows weather for a searched city, and
   the browser console is clean.
3. DevTools → **Application**: the manifest has no errors and lists the 192, 512 and maskable icons; the
   service worker is *activated and running*; Cache Storage holds a precache cache.
4. DevTools → **Network**: `/assets/*` responses are `immutable`; `sw.js` and `/` are revalidated (200 or 304).
5. Tick **Offline** and reload: the app opens, shows **"You're offline"** and the saved forecast with its
   timestamp; a city you never opened says there is no saved weather.
6. Weather icons animate; with the OS "reduce motion" setting on they are static.
7. Install it (address-bar install icon / Add to Home Screen) and open the installed app.
8. After the next deploy: reload once online and confirm the **new version** prompt appears.
9. If analytics is enabled: see the next section.

Not verifiable from here and still open: Lighthouse scores on the live site, real-device installs (especially
iOS/Safari), and the live Vercel headers until step 1 is run against the deployment.

### Web Analytics (opt-in)

`@vercel/analytics` 2.0.1 (MIT) is installed and mounted **once**, at the app root (`src/main.tsx` →
`AppAnalytics`). It is **off until you opt in**, so deploying this code changes nothing for visitors.

To turn it on, in this order:

1. In the Vercel dashboard, open the project's **Analytics** tab and enable **Web Analytics** (follow Vercel's
   current quickstart for the exact UI).
2. Add `VITE_ANALYTICS=on` under Settings → Environment Variables for the **Production** environment only
   (untick Preview and Development).
3. Redeploy production (variables apply to new deployments only).
4. Visit the site, check in DevTools → Network that one analytics script request succeeds, and look for the
   visit in the dashboard (it can take a few minutes). **This end-to-end step has not been done**: tests prove
   the component, the redaction and the failure handling with a stand-in for Vercel's script, not that data
   reaches your dashboard.

How it behaves: it loads as its own 1.3 KB (gzip) chunk; it does not start while offline; if the script is
blocked (ad blocker, privacy mode) or fails, nothing else is affected (weather, search, the service worker,
offline mode and the animations are all covered by tests). Preview and development builds ignore the flag, so
previews cannot reach the production numbers. No custom events, user properties, API keys or locations are
sent.

**Privacy.** Vercel's docs say Web Analytics is cookie-less, identifies visitors by a hash that is discarded
after 24 hours, and records page views with the URL, referrer, approximate country/region/city, device, OS and
browser. WeatherBoard's deep links (`/?lat=…&lon=…&name=…`) contain a city's coordinates, so every event is
reduced to origin and path before it leaves the browser (`redactAnalyticsEvent`, unit and e2e tested); an event
with an unparseable URL is dropped. Whether your audience and jurisdiction need a consent notice is for you to
decide; this is not legal advice.

**Speed Insights — evaluated, not installed.** `@vercel/speed-insights` reports real-user Core Web Vitals to a
separate dashboard feature. It would add another third-party script and its own opt-in, redaction (it supports
`beforeSend` and `sampleRate`) and usage/billing considerations (the exact plan limits were not checked). With
a small, fully static, precached app and the existing local budget checks (entry bundle ~116 KB gzip, enforced
by `e2e/deployment.spec.ts`), the extra signal is modest today. **Recommendation: do not add it yet.** Revisit
once there is steady real traffic and a performance question that lab tests cannot answer; if added, keep it
behind its own flag with a low `sampleRate`.

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
| `npm run verify`    | Typecheck, lint, unit tests, e2e and build, in order, stopping at the first failure |
| `npm run icons`     | Regenerate the PWA icons (`scripts/generate-icons.mjs`) |
| `npm run lottie`    | Regenerate the animated weather icons (`scripts/generate-lottie.mjs`) |
| `npm run check:deployment -- <url>` | Read-only smoke check of a deployed site's status, headers, manifest and icons |

First e2e run needs a browser: `npx playwright install chromium`.

The e2e suite intercepts weather and geocoding requests (in the tests only) so loading, failure,
retry and fallback states are deterministic. It builds the app with a dummy
`VITE_GEODB_API_KEY=e2e-test-key` so the GeoDB path is exercised; a real key in `.env` is never used.
The accessibility specs use `@axe-core/playwright` (a dev-only dependency). The live-API tests (below)
are skipped unless you opt in. Everything else runs in headless Chromium only.
A separate opt-in test calls the **real** APIs (weather and keyless geocoding):

```bash
WEATHER_LIVE=1 npx playwright test e2e/weather-live.spec.ts --workers=1
```

## Environment variables

| Variable             | Required | Notes                                                                                      |
| -------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `VITE_GEODB_API_KEY` | No       | Enables GeoDB search. **Public once built** — restrict by domain and set a quota. Without it, search uses Open-Meteo geocoding. |
| `VITE_ANALYTICS`     | No       | `on` enables Vercel Web Analytics (opt-in; set for Production only; ignored by Vercel preview builds). Not a secret. |

## Project structure

```text
src/
  components/{layout,weather,search,favourites,settings,ui}, AppAnalytics.tsx (opt-in Vercel Web Analytics)
  hooks/      useTheme, useUnits, useFavourites, useSelectedCity, useWeather, useOnlineStatus, useCitySearch,
              useReminderPreference, useNotificationPermission, useReminders, useNow
  services/   weatherApi, weatherCache (IndexedDB), citySearch (+ geoDbApi, openMeteoGeocodingApi, http),
              notificationService, reminderWeather, storageService, weatherAnimations (lazy Lottie loading)
  assets/lottie/  original animated weather icons (generated)
  pwa/        serviceWorker (registration + update state)
  types/      weather, city, preferences
  utils/      weatherCodes, temperature, date, wind, reminder, validation, city, cn, constants
  styles/     globals.css  ← design tokens (light + dark)
scripts/      generate-icons.mjs (PWA icons), generate-lottie.mjs (animated weather icons),
              check-deployment.mjs (read-only deployment smoke check)
vercel.json   Vercel cache and security headers (no rewrites, no build settings)
e2e/          Playwright specs (responsive, a11y-*, layout-short, reflow, weather-animation, theme, contrast,
              weather, search, units, favourites, navigation, pwa, offline, notifications)
e2e/support/  shared setup; audit.ts (page measurements), states.ts (reachable screen states),
              vercelSim.ts (applies vercel.json headers to dist; a local simulation, not Vercel)
```

## Design system

All colours, radii and shadows are semantic tokens in `src/styles/globals.css` (OKLCH, shadcn naming,
plus `--weather-*` accents). Components use utilities such as `bg-card` / `text-muted-foreground`,
never raw colours, so both themes stay consistent. Text/background token pairs are verified against
WCAG AA in `e2e/contrast.spec.ts`.
