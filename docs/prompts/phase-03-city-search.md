# Phase 3 — City Search and Autocomplete

## Objective

Allow users to search for cities and load their weather.

## Instructions for Claude Code

Implement city search and autocomplete in WeatherBoard.

### Search requirements

1. Add a city search input.
2. Display autocomplete suggestions while typing.
3. Debounce search requests.
4. Support city names and location information.
5. Display city and country information in suggestions.
6. Allow keyboard navigation through suggestions.
7. Allow selection using mouse, touch, and keyboard.
8. Load weather after selecting a city.
9. Handle empty searches and API failures.

### API integration

Use:

- GeoDB Cities API where configured.
- Open-Meteo Geocoding API as a fallback.

Use public REST endpoints where possible.

### Reliability

- Avoid unnecessary API requests.
- Handle missing API keys.
- Handle rate limits and network errors.
- Cancel outdated requests.
- Validate city coordinates.
- Avoid duplicate or invalid suggestions.

### Architecture

- Keep search logic separate from UI components.
- Reuse shared HTTP utilities.
- Keep API configuration in environment variables.
- Never commit API keys or secrets.

### Testing

Test:

- Search input behavior
- Debouncing
- Suggestions
- Keyboard navigation
- City selection
- Fallback behavior
- API failures
- Invalid coordinates

### Documentation

Document GeoDB configuration and its limitations.

### Git

Create branch: feature/city-search

Use Conventional Commits.
Do not push directly to main.
