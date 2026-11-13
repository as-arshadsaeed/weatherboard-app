# Phase 5 — PWA and Offline Support

## Objective

Make WeatherBoard an installable Progressive Web App
with useful offline behavior.

## Instructions for Claude Code

### PWA requirements

1. Add a valid web app manifest.
2. Configure application name and short name.
3. Configure standalone display mode.
4. Add appropriate theme and background colors.
5. Add application icons.
6. Support installation from compatible browsers.
7. Configure a service worker.

### Service worker

Cache:

- Application shell
- Static assets
- Required application resources

Do not cache weather API responses in the service worker.

### Weather caching

Use IndexedDB to store weather data.

Requirements:

- Cache the last ten viewed cities.
- Retain cached weather for up to seven days.
- Record cache timestamps.
- Display cached information when offline.
- Clearly identify stale information.
- Refresh weather when connectivity returns.

### Offline behavior

1. Display an offline status banner.
2. Load the cached application shell.
3. Display cached weather when available.
4. Handle missing cached weather gracefully.
5. Refresh data when connectivity returns.

### Constraints

- Do not introduce a custom backend.
- Do not cache sensitive information.
- Do not imply that uncached weather is current.
- Keep service worker caching separate from weather data persistence.

### Testing

Test:

- Manifest validity
- Service worker registration
- Asset caching
- IndexedDB persistence
- Offline reload
- Stale data labels
- Reconnection behavior
- Cache limits
- Cache expiration

### Documentation

Document:

- PWA installation
- Offline limitations
- Browser compatibility
- HTTPS deployment requirements

### Git

Create branch: feature/pwa-offline

Use Conventional Commits.
Do not push directly to main.
