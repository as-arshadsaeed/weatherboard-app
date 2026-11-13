# Phase 4 — Favourites and Settings

## Objective

Add favourite cities, temperature preferences,
and detailed weather information.

## Instructions for Claude Code

### Favourites

1. Allow users to add cities to favourites.
2. Allow users to remove favourite cities.
3. Limit favourites to five cities.
4. Prevent duplicate cities.
5. Persist favourites using localStorage.
6. Restore favourites after page reload.
7. Display a clear confirmation before removing a favourite.
8. Handle localStorage failures gracefully.

### City selection

- Persist the selected city.
- Restore the selected city on reload.
- Allow switching between favourite cities.
- Keep weather information synchronized with selection.

### Temperature settings

Support:

- Celsius
- Fahrenheit

Requirements:

- Celsius is the default.
- Persist the selected unit.
- Convert displayed temperatures correctly.
- Do not change the underlying API data unnecessarily.

### Weather details

Add detail cards for:

- Humidity
- Wind speed
- Precipitation
- Sunrise
- Sunset

### Navigation

Implement responsive navigation suitable for:

- Desktop
- Tablet
- Mobile

### Persistence

Use localStorage for user preferences and favourites.
Handle unavailable or corrupted stored data safely.

### Testing

Test:

- Adding favourites
- Removing favourites
- Five-city limit
- Duplicate prevention
- Persistence
- Unit conversion
- Selected city restoration
- Weather detail rendering
- Storage failures

### Git

Create branch: feature/favourites-and-settings

Use Conventional Commits.
Do not push directly to main.
