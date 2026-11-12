import { useEffect } from 'react'

const APP_NAME = 'WeatherBoard'

/**
 * Keep the page title in step with what is shown ("London · WeatherBoard"). In a single-page app the
 * title is how screen reader users, browser history and tab switchers know the content changed.
 */
export function useDocumentTitle(subject: string | null): void {
  useEffect(() => {
    document.title = subject ? `${subject} · ${APP_NAME}` : APP_NAME
    return () => {
      document.title = APP_NAME
    }
  }, [subject])
}
