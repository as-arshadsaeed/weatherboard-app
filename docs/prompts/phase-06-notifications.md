# Phase 6 — Daily Reminder Notifications

## Objective

Add daily weather reminder settings and notification
support within the existing client-side PWA.

## Instructions for Claude Code

### Settings interface

Add a Settings dialog or responsive settings screen.

Include:

- Daily reminder enable/disable switch.
- Morning reminder time selection.
- Notification permission status.
- Clear permission instructions.
- Appropriate unsupported-browser messaging.

### Permission handling

1. Never request notification permission automatically on page load.
2. Request permission only after explicit user interaction.
3. Explain why permission is needed.
4. Handle granted, denied, dismissed, and unsupported states.
5. Allow users to retry where browser permissions permit.

### Reminder behavior

- Persist reminder preferences.
- Support a configurable morning reminder time.
- Use the selected city.
- Respect the selected temperature unit.
- Use cached weather only when appropriate.
- Do not invent weather information.

### Client-side implementation

Use:

- Notification API
- Service Worker API where supported
- localStorage for preferences
- Existing IndexedDB weather cache

Implement in-app reminders while the application is open.

Check reminder eligibility on:

- Application startup
- Focus events
- Visibility changes
- Reconnection events
- Appropriate periodic checks while the app is active

Avoid duplicate reminders.

### Important limitation

This phase is client-side only.

Do not claim guaranteed background delivery when the browser
or application is closed.

A service worker cannot independently schedule a daily notification.
Document that true scheduled background Web Push requires
an external push sender.

### Notification interaction

- Display an in-app reminder banner.
- Display a native notification when supported and permitted.
- Handle notification clicks.
- Open or focus WeatherBoard appropriately.

### Testing

Test:

- Permission states
- Settings persistence
- Reminder time selection
- Duplicate prevention
- Reminder eligibility
- Cached weather messaging
- Unsupported browsers
- Notification click behavior

### Documentation

Explain the distinction between:

- In-app reminders
- Native notifications while active
- True background Web Push

Document future Web Push requirements separately.

### Git

Create branch: feature/notifications

Use Conventional Commits.
Do not push directly to main.
