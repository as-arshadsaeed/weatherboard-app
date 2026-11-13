# Phase 2 — Weather API Integration

## Objective

Integrate real-time weather information and forecasts.

## Instructions for Claude Code

Integrate Open-Meteo APIs into WeatherBoard.

### API requirements

Use public Open-Meteo REST APIs:

- Geocoding API
- Forecast API

No custom backend.

### Current weather

Display:

- Temperature
- Weather condition
- Weather icon
- Apparent temperature
- Humidity
- Wind speed
- Precipitation

### Forecast

Implement a five-day forecast with:

- Daily minimum temperature
- Daily maximum temperature
- Weather condition
- Weather icon

### Reliability

1. Handle loading states.
2. Handle API errors.
3. Provide retry functionality.
4. Add request timeouts.
5. Abort outdated requests when the selected city changes.
6. Validate API responses.
7. Avoid displaying invented weather data.

### API behavior

- Use metric units by default.
- Keep API logic separate from UI components.
- Handle missing or invalid response fields.
- Display appropriate attribution to Open-Meteo.

### Testing

Add tests for:

- Successful API responses
- Invalid responses
- Network failures
- Timeout behavior
- Request cancellation
- Forecast rendering

Include opt-in live API tests where appropriate.

### Git

Create branch: feature/weather-api

Use Conventional Commits.
Do not push directly to main.
