/*
 * Imported by the generated service worker (workbox `importScripts`).
 * Clicking a WeatherBoard notification focuses an open app window, or opens the app.
 * Plain JavaScript on purpose: it runs in the worker scope, outside the Vite/TypeScript build.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus()
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
