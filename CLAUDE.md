# WeatherBoard — Project Instructions

## 1. Project Overview

Build **WeatherBoard**, a polished, responsive, installable Progressive Web Application (PWA) that allows users to:

- Search for cities worldwide with live autocomplete.
- View real-time weather conditions.
- View a 5-day weather forecast.
- Save up to 5 favourite cities.
- Access previously viewed weather while offline.
- Configure daily weather reminders.
- Switch between light and dark themes.
- Switch between Celsius and Fahrenheit.

The application must feel like a production-quality consumer SaaS product.

### Product principles

- Clean, minimal, modern interface.
- Fast and responsive interactions.
- Accurate real weather data.
- Accessible design.
- Mobile-first development.
- Graceful API and network failure handling.
- No mock weather data in production.
- No unnecessary complexity.
- Client-side architecture wherever technically feasible.

---

## 2. Technology Stack

Use the following stack unless a technical limitation requires a documented alternative.

| Category         | Technology              |
| ---------------- | ----------------------- |
| Framework        | React                   |
| Language         | TypeScript              |
| Build tool       | Vite                    |
| Styling          | Tailwind CSS            |
| UI components    | shadcn/ui               |
| Icons            | Lucide React            |
| Weather API      | Open-Meteo              |
| City search      | GeoDB Cities API        |
| PWA              | Vite PWA Plugin         |
| Offline storage  | IndexedDB               |
| User preferences | localStorage            |
| Animations       | CSS animations / Lottie |
| Date formatting  | date-fns                |
| Deployment       | Vercel / Netlify        |

Use current stable package versions and compatible dependencies.

Do not introduce unnecessary libraries.

---

## 3. Architecture

Build a single-page application using reusable components.

Recommended project structure:

```text
weatherboard/
│
├── public/
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── favicon.svg
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileNavigation.tsx
│   │   │
│   │   ├── weather/
│   │   │   ├── CurrentWeather.tsx
│   │   │   ├── WeatherDetails.tsx
│   │   │   ├── ForecastCard.tsx
│   │   │   ├── FiveDayForecast.tsx
│   │   │   └── WeatherIcon.tsx
│   │   │
│   │   ├── search/
│   │   │   ├── CitySearch.tsx
│   │   │   └── SearchSuggestions.tsx
│   │   │
│   │   ├── favourites/
│   │   │   └── FavouriteCities.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── UnitToggle.tsx
│   │   │   └── NotificationSettings.tsx
│   │   │
│   │   └── ui/
│   │
│   ├── hooks/
│   │   ├── useWeather.ts
│   │   ├── useCitySearch.ts
│   │   ├── useFavourites.ts
│   │   ├── useTheme.ts
│   │   ├── useUnits.ts
│   │   └── useOnlineStatus.ts
│   │
│   ├── services/
│   │   ├── weatherApi.ts
│   │   ├── geoDbApi.ts
│   │   ├── storageService.ts
│   │   └── notificationService.ts
│   │
│   ├── types/
│   │   ├── weather.ts
│   │   ├── city.ts
│   │   └── preferences.ts
│   │
│   ├── utils/
│   │   ├── weatherCodes.ts
│   │   ├── temperature.ts
│   │   ├── validation.ts
│   │   └── date.ts
│   │
│   ├── styles/
│   │   └── globals.css
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── CLAUDE.md
└── README.md
```

Keep components small, reusable and focused on a single responsibility.

Separate API requests, state management, UI components and utility functions.

---

## 4. API Integration

### 4.1 Open-Meteo Weather API

Use Open-Meteo as the primary weather provider.

Documentation:
https://open-meteo.com/en/docs

Use the forecast endpoint:

https://api.open-meteo.com/v1/forecast

Fetch:

**Current weather**

- Temperature.
- Relative humidity.
- Apparent temperature.
- Wind speed.
- Wind direction.
- Weather condition code.
- Day/night indicator.

**Daily forecast**

- Maximum temperature.
- Minimum temperature.
- Weather condition code.
- Precipitation probability.
- Sunrise.
- Sunset.

Request timezone-aware data using the city's timezone.

Display five calendar days of forecast data, including today.

Map Open-Meteo weather codes to readable weather descriptions and appropriate icons.

Do not hardcode weather values.

Include weather data attribution:
"Weather data by Open-Meteo.com"

### 4.2 GeoDB Cities API

Use GeoDB Cities for city autocomplete.

Documentation:
https://rapidapi.com/wirefreethought/api/geodb-cities

Requirements:

- Search as the user types.
- Minimum input length: 2 characters.
- Debounce requests by approximately 250 ms.
- Abort outdated requests.
- Display a maximum of 6 suggestions.
- Display city, region and country.
- Allow selection using keyboard and mouse.
- Show loading, empty and error states.
- Cache recent successful searches where appropriate.

Target: suggestions should appear within 300 ms after the user pauses when network and API conditions permit. Do not claim a guaranteed network response time.

Use environment configuration:

VITE_GEODB_API_KEY=

Important:
Browser environment variables are public and must never be treated as secrets. GeoDB credentials exposed in a frontend build must have appropriate provider-side restrictions and quota limits. If secure credential handling is required, introduce a lightweight server-side proxy, documenting the deviation from the client-only requirement.

Provide a no-key Open-Meteo geocoding fallback if GeoDB is unavailable.

### 4.3 API Error Handling

Every API request must have:

- Loading state.
- Success state.
- Empty state where applicable.
- Error state.
- Timeout handling.
- Network failure handling.
- Request cancellation where appropriate.

Never use generic "Something went wrong" messages.

Examples:

- "Unable to retrieve weather data. Check your internet connection and try again."
- "No cities found. Try another spelling or search by country."
- "City search is temporarily unavailable. Please try again."
- "Weather data is unavailable for this location."

Keep error messages understandable to non-technical users.

---

## 5. City Search and Validation

Build an accessible autocomplete search component.

Requirements:

- Search suggestions appear below the input.
- Suggestions update as the user types.
- Selecting a suggestion fetches its weather.
- Empty input displays an inline validation error on blur.
- Input shorter than two characters displays guidance.
- No-results state is visible.
- API errors are visible.
- Enter selects the highlighted suggestion.
- Arrow keys navigate suggestions.
- Escape closes suggestions.
- Clicking outside closes the suggestion panel.
- Do not submit an unverified city name.

Use appropriate ARIA combobox and listbox attributes.

Prevent race conditions between overlapping search requests.

---

## 6. Weather Dashboard UI

Build a visually polished dashboard.

### Header

Include:

- WeatherBoard logo.
- City search.
- Theme toggle.
- Temperature unit toggle.
- Settings access.

### Main weather section

Display:

- Selected city and country.
- Current date and local time.
- Large current temperature.
- Animated weather icon.
- Weather description.
- Feels-like temperature.
- High and low temperature.

### Weather details

Create compact information cards for:

- Humidity.
- Wind speed.
- Wind direction.
- Precipitation probability.
- Sunrise.
- Sunset.

### Five-day forecast

Create five responsive forecast cards.

Each card should show:

- Day name.
- Weather icon.
- Weather description.
- Maximum temperature.
- Minimum temperature.
- Precipitation probability.

### Favourite cities

Allow users to:

- Add a city to favourites.
- Save a maximum of five cities.
- View favourite cities in a quick-access panel.
- Switch to a favourite city.
- Remove a favourite city after confirmation.

Persist favourites using localStorage.

If localStorage is unavailable, use an in-memory fallback and show a non-blocking message that preferences will not persist.

Prevent duplicate favourites using stable city identifiers or coordinates.

---

## 7. Design System and UI/UX

Use the following products as visual inspiration:

- https://linear.app
- https://vercel.com
- https://stripe.com
- https://mercury.com

Do not directly copy their interfaces.

### Design direction

Create a premium, minimalist weather dashboard.

Design characteristics:

- Spacious layout.
- Clear visual hierarchy.
- Subtle borders.
- Soft shadows.
- Consistent spacing.
- Rounded cards.
- Clean typography.
- Smooth transitions.
- Restrained use of colour.
- Weather-related accent colours.
- Excellent contrast.

Use a consistent design token system.

Avoid excessive gradients, excessive glassmorphism and unnecessary decorative elements.

### Layout

Desktop:

- Sidebar or structured navigation.
- Main weather panel.
- Forecast and details arranged in a responsive grid.

Tablet:

- Compact navigation.
- Two-column content where appropriate.

Mobile:

- Single-column layout.
- Compact header.
- Full-width search.
- Stacked weather cards.
- Horizontally scrollable forecast cards only where necessary.

### Responsive breakpoints

Test at:

- 375px.
- 768px.
- 1280px.

Requirements:

- No unintended horizontal page scrolling.
- Minimum 44 × 44px touch targets on mobile.
- Readable typography.
- Proper spacing.
- No overlapping elements.

---

## 8. Dark and Light Themes

Implement:

- Light mode.
- Dark mode.
- System preference detection.

Requirements:

- Detect the user's operating-system theme on first visit.
- Allow manual switching.
- Persist manual preference.
- Update the interface without page reload.
- Use semantic design tokens rather than hardcoded colours throughout components.

Ensure readable contrast in both themes.

---

## 9. Temperature Unit Switching

Support:

- Celsius.
- Fahrenheit.

Requirements:

- Persist selection in localStorage.
- Update all visible temperature values immediately.
- Update current weather.
- Update forecast.
- Update feels-like temperature.
- Avoid unnecessary API requests when changing units.

Use a centralized temperature conversion utility.

Never mix units in the same display.

---

## 10. Progressive Web Application

Implement a valid installable PWA.

Use Vite PWA Plugin.

### Web manifest

Include:

- name: WeatherBoard
- short_name: WeatherBoard
- start_url: /
- display: standalone
- theme_color
- background_color
- description
- 192 × 192 icon
- 512 × 512 icon

Generate original application icons.

### Service worker

Implement:

- Application shell caching.
- Static asset caching.
- Offline fallback.
- Last-viewed city weather caching.
- Appropriate cache expiration.
- Cache versioning.
- Cache cleanup during activation.

Use IndexedDB to persist the last successfully retrieved weather response.

Do not cache failed API responses as valid weather data.

When offline:

- Display an offline banner.
- Show the last successfully cached city's weather.
- Display the timestamp of the cached data.
- Clearly identify cached data as potentially outdated.
- Keep cached weather available after refreshing the application.

Do not claim offline access for cities that have not been cached.

Ensure service worker updates do not unexpectedly destroy cached weather.

---

## 11. Notifications and Daily Reminders

Build a notification settings interface.

Users should be able to:

- Enable reminders.
- Select a preferred morning reminder time.
- Disable reminders.
- See current notification permission status.

### Permission flow

Before requesting notification permission, explain:

"We'd like to send you a daily morning reminder to check your local weather, so you can plan your day."

Only request permission after the user explicitly enables reminders.

Handle:

- Permission granted.
- Permission denied.
- Notifications unsupported.
- Service worker unavailable.
- Reminder disabled.

Denied permission must never break the weather dashboard.

### Technical limitation

The Notifications API alone cannot guarantee a daily notification when the application is closed.

A real Web Push implementation requires:

- A push subscription.
- A VAPID key pair.
- A push service.
- A server-side sender or scheduled push provider.
- Subscription storage.
- A scheduled job to send reminders.

Because the initial project is client-side only, implement a clearly labelled in-app reminder fallback while the application is open.

Do not claim that a client-side timer or service worker can reliably send scheduled notifications after the browser is closed.

Keep the notification service modular so a server-side Web Push provider can be integrated later without rewriting the UI.

Do not request or implement a fake background push solution.

---

## 12. Data Persistence

Use localStorage for:

- Favourite cities.
- Theme preference.
- Temperature unit.
- Reminder preference.
- Selected city identifier.

Use IndexedDB for:

- Last viewed city weather.
- Last successful weather timestamp.
- Offline weather snapshot.
- Optional recent city cache.

All persistence operations must handle unavailable storage and corrupted data gracefully.

---

## 13. Loading and Empty States

Create polished states for:

- Initial application loading.
- City search loading.
- Weather loading.
- Forecast loading.
- No search results.
- No favourites.
- Offline mode.
- API failure.
- Cached weather display.

Use skeleton loaders where appropriate.

Avoid layout shifts during loading.

Do not display fake weather values while loading.

---

## 14. Performance Requirements

Optimize for:

- Fast initial rendering.
- Minimal unnecessary re-renders.
- Debounced search.
- Cancelled outdated requests.
- Efficient caching.
- Lazy loading where appropriate.
- Small production bundle.
- Responsive animations.

Respect prefers-reduced-motion.

Avoid unnecessary API calls when changing themes, temperature units or dashboard layout.

---

## 15. Accessibility

Follow WCAG 2.2 AA principles where applicable.

Requirements:

- Semantic HTML.
- Keyboard navigation.
- Visible focus states.
- Accessible form labels.
- ARIA attributes for autocomplete.
- Sufficient colour contrast.
- Accessible confirmation dialogs.
- Screen-reader-friendly weather descriptions.
- Reduced motion support.

Never rely on colour alone to communicate weather conditions or errors.

---

## 16. Testing and Quality Assurance

Use:

- Vitest.
- React Testing Library.
- Playwright for end-to-end tests.

Test the following:

### City search

- Valid city search.
- Empty input.
- No matching cities.
- Network failure.
- API error.
- Rapid typing.
- Keyboard selection.

### Weather

- Successful weather fetch.
- Loading state.
- API failure.
- Invalid coordinates.
- Current conditions.
- Five-day forecast.

### Favourites

- Add favourite.
- Remove favourite.
- Maximum five favourites.
- Duplicate prevention.
- Persistence after reload.
- Storage unavailable.

### Preferences

- Theme persistence.
- System theme detection.
- Unit switching.
- Unit persistence.

### PWA

- Manifest validity.
- Service worker registration.
- Application shell caching.
- Offline loading.
- Cached weather display.
- Offline banner.
- Cache updates.

### Notifications

- Unsupported browser.
- Permission denied.
- Permission granted.
- Reminder disabled.
- Honest fallback behaviour.

### Responsive design

Test at:

- 375px.
- 768px.
- 1280px.

No console errors, broken layouts or unintended horizontal overflow.

---

## 17. Code Quality Rules

Follow these rules throughout development:

1. Use TypeScript strict mode.
2. Avoid `any` unless absolutely necessary and documented.
3. Use reusable React components.
4. Keep API logic outside UI components.
5. Keep weather types strongly typed.
6. Use meaningful variable and function names.
7. Handle all asynchronous errors.
8. Avoid duplicated logic.
9. Do not hardcode weather data.
10. Do not commit API credentials.
11. Do not introduce unnecessary dependencies.
12. Keep components maintainable.
13. Use environment variables for configurable API credentials.
14. Add comments only where the implementation needs explanation.
15. Keep the application functional at every development stage.

Before considering a feature complete, verify its loading, success, error and empty states.

---

## 18. Development Phases

Build WeatherBoard incrementally.

Do not attempt to generate the entire project in a single operation.

### Phase 1 — Foundation

- Initialize Vite and React.
- Configure TypeScript.
- Install Tailwind CSS.
- Configure shadcn/ui.
- Set up project structure.
- Create design tokens.
- Build dashboard shell.

### Phase 2 — Weather API

- Integrate Open-Meteo.
- Create weather service.
- Create typed response models.
- Build current weather component.
- Build five-day forecast.
- Implement loading and error states.

### Phase 3 — City Search

- Integrate GeoDB Cities.
- Implement autocomplete.
- Add debounce.
- Add request cancellation.
- Add validation.
- Implement fallback geocoding.

### Phase 4 — Dashboard Features

- Favourite cities.
- Theme toggle.
- Temperature toggle.
- Weather detail cards.
- Responsive navigation.

### Phase 5 — PWA and Offline

- Configure manifest.
- Generate application icons.
- Register service worker.
- Implement application shell caching.
- Implement IndexedDB weather caching.
- Build offline mode banner.

### Phase 6 — Notifications

- Build notification settings.
- Implement permission explanation.
- Implement supported in-app reminder fallback.
- Document the server-side requirements for true background Web Push.

### Phase 7 — Polish and Testing

- Add weather animations.
- Improve transitions.
- Test accessibility.
- Test mobile layouts.
- Test offline behaviour.
- Run automated tests.
- Fix TypeScript and lint errors.

### Phase 8 — Deployment

- Prepare production build.
- Verify HTTPS.
- Verify PWA installation.
- Verify service worker.
- Verify production API configuration.
- Document deployment steps.

---

## 19. Working Instructions

Work as a senior frontend engineer.

Before implementing each phase:

1. Inspect the existing codebase.
2. Explain the intended implementation.
3. Identify dependencies.
4. Identify technical limitations.
5. Implement the phase.
6. Run relevant tests.
7. Fix errors before moving forward.
8. Summarize files changed and functionality completed.

Do not silently skip requirements.

Do not pretend an API, service worker or notification feature works if it has not been tested.

When a requirement conflicts with the client-only architecture, explain the conflict and propose the smallest viable alternative.

Maintain this CLAUDE.md as the source of truth throughout development.

Update README.md with setup, environment variables, API configuration, testing and deployment instructions.

---

## 20. Definition of Done

WeatherBoard is complete when:

- City autocomplete works.
- Real weather data is displayed.
- Five-day forecast works.
- All forms have validation.
- Favourites persist across sessions.
- Theme preference persists.
- Temperature units switch correctly.
- PWA installation works.
- Offline cached weather works.
- Offline status is visible.
- Notification permissions are handled safely.
- Notification limitations are accurately communicated.
- Mobile, tablet and desktop layouts work.
- No critical TypeScript errors.
- No critical console errors.
- Production build succeeds.
- README contains complete setup instructions.

**Final objective:** Deliver a polished, functional, maintainable WeatherBoard PWA, not merely a visual prototype.

---

## 21. Git Workflow and Commit Strategy

Git version control is mandatory throughout development.

### General Rules

1. Initialize Git if the project is not already a Git repository.
2. Never commit directly to `main` during feature development.
3. Use a dedicated feature branch for each development phase or substantial feature.
4. Commit changes after completing and testing each phase or independently testable feature.
5. Never combine unrelated features into one commit.
6. Never commit broken, unfinished or untested code.
7. Never commit API keys, credentials, `.env` files, secrets or generated sensitive data.
8. Review `git status` and `git diff` before every commit.
9. Never overwrite or discard existing user changes.
10. Never use destructive Git commands without explicit approval.

### Branch Naming Convention

Use the following naming convention:

- `feature/project-foundation`
- `feature/weather-api`
- `feature/city-search`
- `feature/favourites-and-settings`
- `feature/pwa-offline`
- `feature/notifications`
- `feature/responsive-polish`
- `feature/production-deployment`

### Commit Message Convention

Follow Conventional Commits.

Format:

`<type>(<scope>): <description>`

Allowed types:

- `feat`: New functionality.
- `fix`: Bug fixes.
- `refactor`: Code restructuring.
- `style`: UI and styling changes.
- `test`: Tests.
- `docs`: Documentation.
- `chore`: Dependencies and configuration.
- `perf`: Performance improvements.

Examples:

- `feat(dashboard): build responsive weather dashboard layout`
- `feat(weather): integrate Open-Meteo API`
- `feat(search): implement city autocomplete`
- `feat(favourites): add persistent favourite cities`
- `feat(pwa): implement offline weather caching`
- `feat(theme): add dark and light mode`
- `fix(search): prevent outdated autocomplete requests`
- `test(weather): add weather API integration tests`
- `docs(readme): document setup and deployment`

### Commit Workflow

At the end of every development phase:

1. Review all modified files.
2. Run TypeScript checks.
3. Run ESLint.
4. Run relevant automated tests.
5. Run the production build.
6. Inspect `git diff`.
7. Verify that no secrets or unwanted files are included.
8. Stage only files related to the completed feature.
9. Create a descriptive Conventional Commit.
10. Report the commit hash and summary.

Do not use `git add .` blindly. Review and stage relevant files deliberately.

### Branch and Merge Strategy

- Keep `main` as the stable branch.
- Create a feature branch for each phase.
- Complete and verify the feature before merging.
- Merge completed feature branches into `main` only after validation.
- Do not automatically push to GitHub.
- Ask for confirmation before pushing or merging if the operation affects a shared remote repository.

### GitHub Push Strategy

- Push each completed and tested development phase to GitHub.
- Push the phase-specific feature branch, never directly to main.
- Push only after all required tests and the production build pass.
- Use `git push -u origin <feature-branch>` for the first push.
- For subsequent updates, use `git push`.
- Do not wait until all eight phases are complete before pushing.
- Do not automatically merge feature branches into main.
- Always obtain explicit user approval before merging into main.
- After pushing, verify that the remote branch exists and report the GitHub branch name and latest commit hash.
- If pushing fails, explain the error and do not claim the changes were uploaded.

### Required Completion Report

After each commit, report:

- Completed feature or phase.
- Branch name.
- Commit message.
- Commit hash.
- Files changed.
- Tests executed.
- Build status.
- Any outstanding issues.

A phase is not complete until its changes are committed successfully.

Never claim a commit succeeded unless Git confirms it.

---

## 22. Implementation Status & Decisions (maintained during development)

**Phase 1 — Foundation: complete** (branch `feature/project-foundation`). **Phase 2 — Weather API: complete** (branch `feature/weather-api`, branched from the Phase 1 branch). **Phase 3 — City Search: complete** (branch `feature/city-search`, branched from the Phase 2 branch). **Phase 4 — Dashboard Features: complete** (branch `feature/favourites-and-settings`, branched from the Phase 3 branch). **Phase 5 — PWA and Offline: complete** (branch `feature/pwa-offline`, branched from the Phase 4 branch). **Phase 6 — Notifications: complete** (branch `feature/notifications`, branched from the Phase 5 branch). Phases 7–8 not started. No branch is merged into `main`; merging needs explicit user approval. Push state is tracked by Git (`git branch -vv`), not by this file.

Git state: `main` holds only the initial README commit.

Decisions / deviations from the spec:

- **Versions:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`, tokens via `@theme inline`; no `tailwind.config`), Vitest 4.
- **shadcn/ui:** `components.json` is configured (aliases `@/components/ui`, `@/utils/cn`). Primitives are added by hand/adapted rather than via the CLI, which mis-resolved the `@/utils/cn` alias and installed an unrelated `cn` npm package. Verify CLI output before accepting it.
- **Font:** Inter is self-hosted via `@fontsource-variable/inter` (not Google Fonts) so it works offline in the PWA.
- **Layout / navigation (Phase 4):** from tablet width the persistent sidebar (favourites column; 15 rem at md, 18 rem at xl) *is* the navigation. On phones a fixed bottom tab bar (`MobileNavigation`: Weather / Favourites) switches between two views, because favourites at the bottom of a long page were hard to reach. The bar is `md:hidden` (so out of the tab order and accessibility tree at md+), 56 px tall, honours the iOS safe-area inset, and the page has bottom padding so it never covers content. The current tab is marked by a top bar + bolder label + `aria-current`, not colour alone. `view` state is irrelevant at md+ (both panes are always shown). **Settings access (done in Phase 6):** a gear button in the header from md up and a third "Settings" button in the bottom bar on phones (the header has no room for another 44 px control at 375 px). Both open one modal settings dialog; on phones Settings is a button, not a view, so it never takes `aria-current`. Theme and units stay in the header.
- **Theme:** the toggle (scheduled for Phase 4) was implemented in Phase 1 and confirmed/tested in both themes in Phase 4. A pre-paint script in `index.html` prevents a flash; its storage key must match `THEME_STORAGE_KEY`.
- **Animations:** CSS/SVG only; Lottie is not used unless a clear technical benefit appears.
- **Location deep link:** `?lat=&lon=&name=&country=&region=&tz=` is still parsed by `parseCityFromSearch` as the *initial* city (handy for sharing/testing). Choosing a city in the search replaces it. Out-of-range or non-numeric coordinates reach the weather service, which rejects them with "Weather data is unavailable for this location." and makes no request. The URL is not rewritten on selection; persisting the selected city is Phase 4 (localStorage).
- **Weather service:** `services/weatherApi.ts` — 10 s timeout, caller-abort re-thrown (never shown as an error), specific messages per failure kind (`network`, `timeout`, `invalid-location`, `rate-limited`, `unavailable`, `bad-response`), and runtime validation so malformed payloads are never treated as weather. Data is always requested in °C and km/h; conversion to °F happens in `utils/temperature.ts`. The city's timezone is sent when known, otherwise `timezone=auto`.
- **Data fetched but not yet displayed:** humidity, wind speed/direction, precipitation probability detail, sunrise and sunset are fetched and typed, but the detail cards belong to Phase 4. Precipitation probability is shown on forecast cards and is `null` (shown as "–") when the model has none, never an invented 0%.
- **Units (Phase 4):** `useUnits` + `UnitToggle` (°C/°F segmented control of `aria-pressed` buttons; accessible names "Celsius (°C)"/"Fahrenheit (°F)" so the visible label is inside the name). Persisted under `weatherboard:unit`, default Celsius, corrupt values ignored. Weather is always fetched in °C and converted for display, so switching never refetches. Wind stays in km/h in both units (the spec only covers temperature; a mph option for Fahrenheit users is a possible later enhancement).
- **Local time:** the "local time" clock is computed from the city's IANA timezone with `Intl` and refreshes every 30 s, independent of fetching.
- **Weather icon animation:** CSS only (`--animate-weather-float` / `--animate-weather-spin` in `globals.css`), disabled by the global `prefers-reduced-motion` rule. Phase 7 may extend it.
- **Testing notes:** unit tests mock `fetch`; Playwright intercepts the Open-Meteo URL **in tests only** (the app contains no mock data). `e2e/weather-live.spec.ts` hits the real API and is opt-in: `WEATHER_LIVE=1 npx playwright test e2e/weather-live.spec.ts --workers=1` (run serially: cold connections can exceed the 10 s timeout when parallel).
- **Shared HTTP helper:** `services/http.ts` (`requestJson`: timeout, caller-abort re-thrown, `network`/`timeout`/`http-error`/`invalid-json` classification) is used by the weather, GeoDB and Open-Meteo geocoding services. Phase 2's `weatherApi` was refactored onto it with unchanged behaviour (its tests are unchanged).
- **City search architecture:** `services/citySearch.ts` orchestrates: GeoDB first when `VITE_GEODB_API_KEY` is set, otherwise (or when GeoDB fails: network, timeout, 429, outage, malformed body) the keyless Open-Meteo geocoding API. An *empty* GeoDB result is authoritative and is **not** retried elsewhere. Successful searches (including empty ones, never errors) are cached in memory: 10-minute TTL, 50-entry LRU. Max 6 suggestions are enforced in each provider mapper. Open-Meteo candidates (10 requested) are re-ranked by population because its own ranking is fuzzy (it returned "Loni" before "London").
- **GeoDB specifics:** request is `GET https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=&limit=6&sort=-population&types=CITY` with `X-RapidAPI-Key`/`X-RapidAPI-Host`. The free plan is about 1 request/second, so fast typing can hit 429; that is handled by the fallback. List results carry no timezone (weather then uses `timezone=auto`); Open-Meteo geocoding does supply one. **GeoDB's live behaviour is unverified** (no key was available): the mapper follows the documented shape and tolerates `name`/`city` and missing optional fields, and skips unusable items. Verify with a real key before relying on it. The Open-Meteo path was verified live.
- **`useCitySearch`:** 250 ms debounce, minimum 2 characters (after trimming/collapsing whitespace), aborts outdated requests, ignores late responses by request key. While the user types, the previous state stays visible and its `query` field marks it stale.
- **`CitySearch` combobox (ARIA 1.2):** `role=combobox` on the input with `aria-expanded/controls/activedescendant/autocomplete=list`; options in a `role=listbox`; focus never leaves the input. The first option is highlighted by default only when results are *fresh* for the exact text typed, so Enter can never pick stale suggestions; Enter with no highlighted option does nothing (free text is never submitted). ArrowUp/Down wrap, Escape closes, Tab/blur/outside pointer-down close. A polite sr-only live region announces loading/results/empty/error, so tests that look for visible text must exclude `role=status`. Empty input shows an inline error on blur; 1 character shows guidance. Input text is 16 px on mobile to stop iOS zoom-on-focus; options are at least 44 px tall.
- **Header order:** DOM order is logo → search → theme toggle so focus order matches visual order from tablet up; on mobile CSS `order` puts the toggle beside the logo and search on its own row (a deliberate, minor focus/visual mismatch there).
- **E2E build uses a dummy key:** `playwright.config.ts` builds with `VITE_GEODB_API_KEY=e2e-test-key` (shell env beats `.env` in Vite) so the GeoDB path is active and every geocoding request is intercepted; no real key is ever used by tests. The no-key path is covered by unit tests and by the live test (which blocks the GeoDB host).
- **Favourites (Phase 4):** `useFavourites` — at most 5, persisted under `weatherboard:favourites`. Duplicates are detected by `isSameCity`: same `id`, **or** coordinates within 0.02° (~2 km), because GeoDB and Open-Meteo give the same city different ids (a favourite saved from one is recognised when found via the other). Stored data is validated; `sanitizeCities` salvages the valid entries of a partly corrupted list (deduplicated, capped at 5). The last selected city is persisted under `weatherboard:selectedCity` (spec §12 "selected city identifier"; the whole `City` is stored because coordinates are needed to reload it). A `?lat=&lon=` deep link wins as the initial city but does not overwrite the stored selection until the user selects something.
- **Remove confirmation:** `ConfirmDialog` is built on the native `<dialog>` (`showModal()`; `role="alertdialog"`, labelled/described, focus starts on the safe "Keep" button, Escape and backdrop click cancel, state owns closing). No dependency was added. A native modal makes the page inert but does **not** wrap Tab inside the dialog (focus can pass to the browser UI); the guarantee tested is that focus can never land on background content. jsdom lacks `showModal()`, so `src/test/setup.ts` shims it (only toggles `open`); real behaviour is verified in Playwright. After a removal, if the removed item's button was the focused element, focus moves to the Favourites heading (also covers browsers that fail to restore focus).
- **Storage failure handling:** `storageService` now exposes `subscribeToStorageStatus` (notifications deferred to a microtask so reads during render are safe) and `probeStorage()` (called once from `App`, so the notice appears before the first failed save). A successful *read* never marks storage healthy again — only a successful write does. `StorageNotice` is a non-blocking, dismissible notice; everything keeps working in memory for the session. There is no cross-tab `storage`-event sync.
- **Detail cards (Phase 4):** humidity, wind speed, wind direction (16-point compass name + bearing + arrow; the bearing is where the wind blows *from*), precipitation chance (today's daily max), sunrise and sunset shown as the city's wall-clock times (`formatLocalClock`, no timezone conversion). `apparent_temperature`, humidity, wind speed and direction are now nullable in the model: a missing value shows "Not available" instead of rejecting the whole report (temperature, weather code and day/night remain required). Clocks use a numeric hour ("7:13 AM").
- **Loading skeleton:** reserves the details cards, the attribution line and (when the card has an action) the favourite button, so the layout shifts by less than 24 px when data arrives (enforced by e2e).
- **Playwright pitfalls found:** role-name matching is a *substring* match (use `exact: true` for e.g. "Saved", which also matched "Favourites, 5 of 5 saved"); the bottom bar's `<ul>` adds list items on phones (scope forecast queries to `main`); a hidden phone view means the Favourites panel must be reached via the tab bar; `getByRole` does not know about modal inertness (test `focus()` instead); capture screenshots after transitions settle.
- **Process notes (commit hygiene):** three slips happened in Phase 4 and were repaired with follow-up commits rather than history rewrites: `0c89871` does not typecheck on its own (the consumer fix is in the next commit `ccd3bb6`); `5df71ee` fixed a lint error introduced in `ccd3bb6` that a piped `| tail` check had hidden; `7081ea0` was committed with 3 stale e2e assertions, fixed in `294ba35`. Verification must use real exit codes (`npm run lint`, `npx playwright test`), never a `grep`/`tail` summary in a `&&` chain.
- **PWA (Phase 5):** `vite-plugin-pwa` v2.0.0 (peer range includes Vite 8, so no deviation). `generateSW`, `registerType: 'prompt'`, `injectRegister: false`: registration lives in `src/pwa/serviceWorker.ts` (external store: `needRefresh`, `offlineReady`) and is started from `main.tsx`. Manifest: `id`/`scope`/`start_url` `/`, `display: standalone`, `theme_color` and `background_color` `#f8fafc` (the light `--background`; `e2e/pwa.spec.ts` fails if they drift from the token), 192 and 512 icons (`any`) plus a 512 `maskable`. `index.html` has light/dark `theme-color` metas (kept in step with the app theme by `useTheme`, including a manual override), an Apple touch icon and standalone hints.
- **Icons:** original, rendered from the app's own mark (same artwork as `favicon.svg`) by `scripts/generate-icons.mjs` using Playwright's Chromium (`npm run icons`): `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (full-bleed, mark inside the safe zone), `apple-touch-icon.png` (180). No image library added.
- **Service worker:** content-hashed **precache** of the shell and every static asset (js, css, html, svg, png, **all** woff2 subsets, manifest): 23 entries, ~648 KiB uncompressed. `navigateFallback: /index.html` (deep links open offline), `cleanupOutdatedCaches` (old versions deleted on activation), `clientsClaim`. No runtime caches, so there is nothing else to version or clean. "Appropriate cache expiration" is implemented where data can go stale: the IndexedDB weather store (7 days, 10 cities).
- **Deliberate deviation — the worker does not cache weather:** spec §10 lists "last-viewed city weather caching" under the service worker, but a worker cache serves stale forecasts as if they were live, so the app could not label them as outdated (also required by §10). Weather is therefore kept in the app-owned IndexedDB with its retrieval time; `e2e/pwa.spec.ts` asserts the built `sw.js` contains no API URLs or runtime routes.
- **Updates:** prompt-based, never automatic. A new version installs and waits; `UpdatePrompt` offers Reload / Later (saved cities, settings and saved weather are untouched by an update). Hourly and on-reconnect `registration.update()` checks. Two plugin/workbox quirks are handled in `serviceWorker.ts`: workbox treats any update found after the first as "external" and the plugin's own reload handler ignores those, so the app reloads itself on `controllerchange`; and workbox can announce the same waiting worker twice (installed, then waiting), so "Later" is remembered per waiting-worker object (a newer worker still prompts). `OfflineReadyNotice` says the app can open offline but weather only for cities already viewed.
- **Offline weather (IndexedDB):** database `weatherboard` v1, store `weather-snapshots`, via a small hand-written promise wrapper (`services/weatherCache.ts`; `fake-indexeddb` is a test-only devDependency). One snapshot per place (matched with `isSameCity`), most recent 10, expiring after 7 days, each stored with `savedAt` = the report's `fetchedAt`. Only validated successful reports are saved (never errors or malformed data); reads validate with `isWeatherReport` and delete corrupt/expired entries; every function is safe when IndexedDB is unavailable (returns null, never throws) and a failed open is retried later. Worker updates never touch this database.
- **Offline behaviour:** `useWeather(city, online)` → states `success`, `cached` (`reason: offline | unreachable`, `refreshing`), `error`. Offline → saved forecast for *that city* or a plain "no saved weather" error (new `offline` error kind); never another city's data. Online but unreachable (network, timeout, 429, outage, bad response; **not** an API-rejected location) → saved forecast with "Try again". Reconnecting (or Try again) re-fetches, keeps the saved view on screen meanwhile (no skeleton flash) and replaces the stored snapshot. `navigator.onLine === false` is reliable, `true` is not, hence the unreachable path; the app never claims to be offline unless the browser says so. `CachedWeatherNotice` always shows the absolute time and the relative age and "conditions may have changed"; `OfflineBanner` shows offline and a brief "back online".
- **No custom install button:** installability relies on the browser's own UI. Chromium's installability check (CDP `Page.getInstallabilityErrors`) reports no errors against the production build; installing on real devices needs HTTPS and is verified in Phase 8.
- **Bugs found by the tests and fixed this phase:** a failed IndexedDB open was cached for the whole session (assignment overwrote the reset); the plugin's reload ignoring later-discovered updates; the update prompt re-opening after "Later"; and a page-grid break on tablet/desktop whenever any notice was visible (the notices wrapper must sort with the sidebar: `md:order-first`) — latent since the Phase 4 storage notice.
- **Verification:** `npm run verify` runs typecheck, lint, unit tests, Playwright and the build with real exit codes. Each Phase 5 commit was also checked out alone (worktree) and passed typecheck, lint and unit tests. The update e2e tests briefly rewrite the served `dist/sw.js` (Playwright cannot intercept a worker's script updates without an experimental flag), so they live in one serial describe in one file.
- **Notifications (Phase 6) — delivery model:** client-side only, **no backend added** (discuss the architecture first). Reminders fire only while the app is open. `REMINDER_DELIVERY` (`services/notificationService.ts`) is `{ kind: 'in-app', backgroundDelivery: false }` and the Settings copy is driven by it; a future Web Push provider would set `backgroundDelivery: true` and replace the in-app scheduler. The server-side requirements for real push (push subscription, VAPID pair, push service, server sender, subscription storage, scheduled job, a `push` handler in the worker) are documented in the README. Nothing implies guaranteed background delivery anywhere in the UI, and tests assert it.
- **Scheduling (`utils/reminder.ts`, `hooks/useReminders.ts`):** pure functions for `nextReminderAt`, `isReminderDue`, `armedLastFiredOn`, using calendar-day arithmetic (DST- and timezone-safe). The scheduler checks every 30 s and on focus / visibility / online (background tabs are throttled, laptops sleep) and fires inside a **30-minute grace window**; a missed reminder is **skipped, never sent late**. It never fires twice in a day (`lastFiredOn`, re-read from storage so a second open tab loses the race). Enabling a reminder or changing its time **re-arms** it: if today's time has already passed, today counts as done, so nothing fires immediately. Content is built **when it fires** from the then-selected city and unit (`buildReminderMessage`): never mixes units, omits missing values, labels saved weather with its age, says to pick a city when none is selected, and never invents weather.
- **Delivery:** an in-app `ReminderBanner` always; plus a system notification only when permission is granted **and** the page is not in front of the user (`shouldShowSystemNotification`), via `registration.showNotification` (required on Android Chrome, where the `Notification` constructor throws) with a constructor fallback and a one-per-day `tag`. A test reminder is always also a system notification when allowed. `public/sw-notifications.js` (imported by the generated worker through `workbox.importScripts`) handles `notificationclick` (focus an open window or open the app); it is unit-tested by running it against a fake worker scope.
- **Permission flow (spec §11):** the exact sentence is shown only after the user turns the reminder on; the browser is asked **only** when the user presses "Allow notifications" (no request on load, on opening Settings, or on turning the switch on — asserted in unit and e2e tests). States: granted, denied (explains how to change it; no retry button, browsers will not ask again), default (a dismissed prompt can be retried), unsupported (no `Notification` API), and "granted but no service worker" (warns system notifications may not appear). In every state the in-app reminder still works and the dashboard is unaffected. `useNotificationPermission` stays in step with browser settings via the Permissions API and focus.
- **Preferences:** `weatherboard:reminder` = `{ enabled, time: "HH:mm", lastFiredOn }`, validated on read (corrupt values ignored), in-memory fallback when storage is blocked (the existing storage notice appears). The selectable time is **morning only, 05:00 to 11:59**: an invalid or empty time shows a specific message and is never saved; leaving the field reverts to the saved time.
- **Shared dialog:** the native-`<dialog>` logic from Phase 4 was extracted to `ui/dialog.tsx` (used by `ConfirmDialog` and `SettingsDialog`); `ui/switch.tsx` is a `role="switch"` button with a 44 px hit area and a ✓/– mark so state is never colour-only.
- **Testing limits (be honest about them):** headless Chromium reports `Notification.permission` as `denied` even after `grantPermissions`, and `registration.showNotification` then refuses, so the **operating-system popup cannot be automated**. E2E uses an injected `Notification` stand-in for the permission flows and records the call made on the **real** service worker registration (title, body, tag, icon, data) for the delivery paths; the popup itself needs a manual check in a normal browser window. Time-based tests use Playwright's fake clock (`page.clock`) with a fixed timezone and locale (`Europe/London`, `en-US`).
- **Bugs/lessons this phase:** a counted-Tab skip-link e2e test broke when the Settings tab became the last control (it now focuses the link directly); a missing test file was committed late (`aa983d5`) instead of with its code (`88cdb83`).
- **Not yet built:** polish and animations (Phase 7), deployment config (Phase 8).
- **ESLint:** `react-refresh/only-export-components` is disabled for `src/components/ui/**` only (shadcn exports variant helpers beside components).
- **Known advisories:** `npm audit` reports 14 moderate/low advisories, all build/lint-time only and none shipped: `minimatch` via ESLint tooling, and (new with the PWA plugin) `workbox-build` → `glob`/`minimatch` and a low-severity `deepmerge` via a Rollup plugin. The only plugin code in the browser bundle is `workbox-window`, which has none. The offered fixes downgrade ESLint/the plugin; revisit when upstream patches.

Known technical limitations to honour in later phases:

- **GeoDB key** is public in a client bundle → provider-side restriction required (domain restriction, quota); Open-Meteo geocoding is the keyless fallback and is used automatically when the key is absent or GeoDB fails. GeoDB's free tier (~1 request/second) can rate-limit rapid typing.
- **Offline limits:** the app can only open offline after one online visit (the worker installs on the first load); weather is offline only for the last 10 cities viewed and for 7 days (favourites are not prefetched); search needs a network; there is no background sync. Chromium is the only browser the e2e suite runs in; iOS/Safari install and eviction behaviour are untested. Deployment must serve `/sw.js` and `/manifest.webmanifest` with `Cache-Control: no-cache` (Phase 8).
- **Cross-tab sync:** favourites/unit changes made in one tab are not pushed to other open tabs (no `storage` event listener).
- **Web Push** cannot be delivered reliably with the app closed without a server (VAPID, subscription store, scheduler). Phase 6 ships an honest in-app reminder fallback only: reminders appear only while the app is open, a reminder missed by more than 30 minutes is skipped, and iOS/Safari additionally require an installed (Home Screen) app for notifications at all — untested here.
