import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/globals.css'
import App from '@/App'
import { AppAnalytics } from '@/components/AppAnalytics'
import { startServiceWorker } from '@/pwa/serviceWorker'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AppAnalytics />
  </StrictMode>,
)

// Registered after the first render (and after window load) so it never competes with startup.
startServiceWorker()
