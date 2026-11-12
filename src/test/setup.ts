import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, vi } from 'vitest'

import { resetWeatherCacheForTests } from '@/services/weatherCache'

// The real Lottie player draws SVG and needs layout, which jsdom does not have. Every test gets this inert
// stand-in; the animation tests (WeatherIcon.test.tsx) install their own recording player.
vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: {
    loadAnimation: () => ({ play: () => {}, pause: () => {}, destroy: () => {} }),
  },
}))

// jsdom implements <dialog> without showModal()/close(). This shim only toggles the `open`
// attribute; focus trapping, Escape and inertness are verified against a real browser in Playwright.
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

afterEach(() => {
  cleanup()
  // A fresh in-memory IndexedDB per test so saved weather never leaks between tests.
  resetWeatherCacheForTests()
  globalThis.indexedDB = new IDBFactory()
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})
