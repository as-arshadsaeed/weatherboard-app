import { expect, type Page } from '@playwright/test'

/** Wait until the worker is active AND controlling this page (it claims clients on first install). */
export async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
}
