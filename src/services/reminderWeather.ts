import { fetchWeather } from '@/services/weatherApi'
import { loadWeatherSnapshot, saveWeatherSnapshot } from '@/services/weatherCache'
import type { City } from '@/types/city'
import type { ReminderWeather } from '@/utils/reminder'

const REMINDER_FETCH_TIMEOUT_MS = 8_000

/**
 * The weather to put in a reminder: a fresh forecast if it can be fetched, otherwise what was saved
 * earlier for that city (the message then says so), otherwise null. Never throws.
 */
export async function loadReminderWeather(city: City): Promise<ReminderWeather | null> {
  if (navigator.onLine) {
    try {
      const report = await fetchWeather(city, { timeoutMs: REMINDER_FETCH_TIMEOUT_MS })
      void saveWeatherSnapshot(city, report)
      return { report, source: 'live' }
    } catch {
      // fall back to what we saved earlier
    }
  }
  const snapshot = await loadWeatherSnapshot(city)
  return snapshot ? { report: snapshot.report, source: 'saved' } : null
}
