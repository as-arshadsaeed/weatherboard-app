import { describe, expect, it } from 'vitest'

import { isAnalyticsEnabled, redactAnalyticsEvent } from '@/utils/analytics'

describe('isAnalyticsEnabled', () => {
  it.each([
    ['nothing set (local build, tests)', undefined, undefined, false],
    ['nothing set, a Vercel production build (opt-in only: deploying changes nothing)', undefined, 'production', false],
    ['empty flag', '', 'production', false],
    ['the flag set to off', 'off', 'production', false],
    ['an unrecognised value is not "on"', 'true', 'production', false],
    ['on, Vercel production build', 'on', 'production', true],
    ['on, Vercel system variables not exposed (empty)', 'on', '', true],
    ['on, outside Vercel (e.g. a self-hosted build)', 'on', undefined, true],
    ['on is case and space tolerant', ' ON ', 'production', true],
    ['on, but a Vercel preview build: refused, so previews cannot reach production numbers', 'on', 'preview', false],
    ['on, but a Vercel development build: refused', 'on', 'development', false],
  ])('%s', (_name, flag, vercelEnv, expected) => {
    expect(isAnalyticsEnabled(flag, vercelEnv)).toBe(expected)
  })
})

describe('redactAnalyticsEvent', () => {
  const page = (url: string) => ({ type: 'pageview' as const, url })

  it('keeps only the origin and path', () => {
    expect(redactAnalyticsEvent(page('https://weatherboard.example/'))).toEqual(page('https://weatherboard.example/'))
  })

  it('removes a deep link’s coordinates, name and every other query parameter', () => {
    const result = redactAnalyticsEvent(
      page('https://weatherboard.example/?lat=51.5085&lon=-0.1257&name=London&country=United%20Kingdom&tz=Europe%2FLondon&utm_source=x'),
    )
    expect(result?.url).toBe('https://weatherboard.example/')
    expect(JSON.stringify(result)).not.toMatch(/51\.5|0\.12|London|lat|lon|utm/)
  })

  it('removes the fragment', () => {
    expect(redactAnalyticsEvent(page('https://weatherboard.example/#section'))?.url).toBe('https://weatherboard.example/')
  })

  it('keeps the event type and does not modify the original event', () => {
    const original = { type: 'event' as const, url: 'https://weatherboard.example/?lat=1' }
    const result = redactAnalyticsEvent(original)
    expect(result?.type).toBe('event')
    expect(original.url).toBe('https://weatherboard.example/?lat=1')
  })

  it.each(['', 'not a url', '/relative/path?lat=1', 'javascript:alert(1)'.replace('javascript', 'ht tp')])(
    'drops an event whose URL cannot be parsed (%j) instead of sending it as-is',
    (url) => {
      expect(redactAnalyticsEvent(page(url))).toBeNull()
    },
  )
})
