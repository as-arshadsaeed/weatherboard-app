import type { City } from '@/types/city'

/** TEST-ONLY city fixtures (never imported by application code). */
export const london: City = {
  id: 'geodb:1',
  name: 'London',
  region: 'England',
  country: 'United Kingdom',
  latitude: 51.5085,
  longitude: -0.1257,
}
export const paris: City = { id: 'geodb:2', name: 'Paris', region: 'Île-de-France', country: 'France', latitude: 48.8534, longitude: 2.3488 }
export const tokyo: City = { id: 'geodb:3', name: 'Tokyo', region: 'Tokyo', country: 'Japan', latitude: 35.6895, longitude: 139.6917 }
export const berlin: City = { id: 'geodb:4', name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.405 }
export const madrid: City = { id: 'geodb:5', name: 'Madrid', country: 'Spain', latitude: 40.4168, longitude: -3.7038 }
export const rome: City = { id: 'geodb:6', name: 'Rome', country: 'Italy', latitude: 41.9028, longitude: 12.4964 }

/** The same place as `london`, as a second geocoding provider reports it. */
export const londonFromOtherProvider: City = {
  id: 'open-meteo:2643743',
  name: 'London',
  region: 'England',
  country: 'United Kingdom',
  latitude: 51.50853,
  longitude: -0.12574,
  timezone: 'Europe/London',
}
