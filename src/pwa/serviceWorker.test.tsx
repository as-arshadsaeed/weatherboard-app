import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OfflineReadyNotice } from '@/components/layout/OfflineReadyNotice'
import { UpdatePrompt } from '@/components/layout/UpdatePrompt'
import {
  applyServiceWorkerUpdate,
  resetServiceWorkerStateForTests,
  startServiceWorker,
} from '@/pwa/serviceWorker'
import { registerSWCalls, updateServiceWorker } from '@/test/stubs/pwa-register'

function supportServiceWorkers(supported: boolean) {
  if (supported) {
    Object.defineProperty(navigator, 'serviceWorker', { value: new EventTarget(), configurable: true })
  } else {
    delete (navigator as unknown as Record<string, unknown>).serviceWorker
  }
}

const lastOptions = () => registerSWCalls.at(-1)!

beforeEach(() => {
  resetServiceWorkerStateForTests()
  registerSWCalls.length = 0
  updateServiceWorker.mockClear()
  supportServiceWorkers(true)
})
afterEach(() => {
  supportServiceWorkers(false)
  vi.useRealTimers()
})

describe('startServiceWorker', () => {
  it('registers once, however many times it is called', () => {
    startServiceWorker()
    startServiceWorker()
    expect(registerSWCalls).toHaveLength(1)
  })

  it('does nothing in browsers without service workers', () => {
    supportServiceWorkers(false)
    expect(() => startServiceWorker()).not.toThrow()
    expect(registerSWCalls).toHaveLength(0)
  })

  it('only warns (never throws) when registration fails: the app still works', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    startServiceWorker()
    expect(() => lastOptions().onRegisterError?.(new Error('boom'))).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })

  describe('update checks', () => {
    const registration = () => ({ update: vi.fn(async () => {}) }) as unknown as ServiceWorkerRegistration & { update: ReturnType<typeof vi.fn> }

    it('checks for a new version hourly, and when the connection returns', () => {
      vi.useFakeTimers()
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
      const reg = registration()
      startServiceWorker()
      lastOptions().onRegisteredSW?.('/sw.js', reg)

      vi.advanceTimersByTime(60 * 60 * 1000)
      expect(reg.update).toHaveBeenCalledTimes(1)
      window.dispatchEvent(new Event('online'))
      expect(reg.update).toHaveBeenCalledTimes(2)
    })

    it('does not check while offline', () => {
      vi.useFakeTimers()
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const reg = registration()
      startServiceWorker()
      lastOptions().onRegisteredSW?.('/sw.js', reg)
      vi.advanceTimersByTime(60 * 60 * 1000)
      expect(reg.update).not.toHaveBeenCalled()
    })

    it('tolerates a missing registration', () => {
      startServiceWorker()
      expect(() => lastOptions().onRegisteredSW?.('/sw.js', undefined)).not.toThrow()
    })
  })
})

describe('applyServiceWorkerUpdate', () => {
  it('asks the waiting worker to take over, then reloads once it controls the page', async () => {
    const reload = vi.fn()
    startServiceWorker()
    await applyServiceWorkerUpdate(reload)
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
    expect(reload).not.toHaveBeenCalled() // not until the new worker actually takes control

    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads only once even if control changes repeatedly', async () => {
    const reload = vi.fn()
    startServiceWorker()
    await applyServiceWorkerUpdate(reload)
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing before the worker has been registered', async () => {
    const reload = vi.fn()
    await applyServiceWorkerUpdate(reload)
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(updateServiceWorker).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('UpdatePrompt', () => {
  it('is hidden until a new version is waiting', () => {
    startServiceWorker()
    render(<UpdatePrompt />)
    expect(screen.queryByText(/new version/i)).toBeNull()
  })

  it('appears when an update is ready, and reassures that saved data is kept', () => {
    startServiceWorker()
    render(<UpdatePrompt />)
    act(() => lastOptions().onNeedRefresh?.())
    expect(screen.getByRole('status')).toHaveTextContent('A new version of WeatherBoard is ready.')
    expect(screen.getByRole('status')).toHaveTextContent('saved cities and settings are kept')
  })

  it('reloads only when the user chooses to', async () => {
    const user = userEvent.setup()
    startServiceWorker()
    render(<UpdatePrompt />)
    act(() => lastOptions().onNeedRefresh?.())
    expect(updateServiceWorker).not.toHaveBeenCalled() // never automatic

    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('does not re-open after "Later" when the same waiting worker is announced again', async () => {
    const user = userEvent.setup()
    const workerA = {} as ServiceWorker
    const registration = { waiting: workerA, update: vi.fn() } as unknown as ServiceWorkerRegistration
    startServiceWorker()
    lastOptions().onRegisteredSW?.('/sw.js', registration)
    render(<UpdatePrompt />)

    act(() => lastOptions().onNeedRefresh?.())
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText(/new version/i)).toBeNull()

    // Workbox fires "installed" and then "waiting" for the same worker; the second must be ignored.
    act(() => lastOptions().onNeedRefresh?.())
    expect(screen.queryByText(/new version/i)).toBeNull()
  })

  it('prompts again for a genuinely newer version after "Later"', async () => {
    const user = userEvent.setup()
    const registration = { waiting: {} as ServiceWorker, update: vi.fn() } as { waiting: ServiceWorker | null; update: unknown }
    startServiceWorker()
    lastOptions().onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration)
    render(<UpdatePrompt />)

    act(() => lastOptions().onNeedRefresh?.())
    await user.click(screen.getByRole('button', { name: 'Later' }))

    registration.waiting = {} as ServiceWorker // a different, newer worker
    act(() => lastOptions().onNeedRefresh?.())
    expect(screen.getByText('A new version of WeatherBoard is ready.')).toBeVisible()
  })

  it('"Later" dismisses it without reloading', async () => {
    const user = userEvent.setup()
    startServiceWorker()
    render(<UpdatePrompt />)
    act(() => lastOptions().onNeedRefresh?.())
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText(/new version/i)).toBeNull()
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})

describe('OfflineReadyNotice', () => {
  it('is hidden by default', () => {
    startServiceWorker()
    render(<OfflineReadyNotice />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('announces that the app can open offline, without overpromising about weather', () => {
    startServiceWorker()
    render(<OfflineReadyNotice />)
    act(() => lastOptions().onOfflineReady?.())
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('WeatherBoard can now open without a connection.')
    expect(notice).toHaveTextContent('only for cities you have already viewed')
  })

  it('can be dismissed', async () => {
    const user = userEvent.setup()
    startServiceWorker()
    render(<OfflineReadyNotice />)
    act(() => lastOptions().onOfflineReady?.())
    await user.click(screen.getByRole('button', { name: 'Dismiss offline-ready notice' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
