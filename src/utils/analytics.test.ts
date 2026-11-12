import { describe, expect, it } from 'vitest'

import { isAnalyticsEnabled, redactAnalyticsEvent } from '@/utils/analytics'

describe('isAnalyticsEnabled', () => {
  it.each([
    ['unset flag, local or tests (no Vercel env)', undefined, undefined, false],
    ['unset flag, empty Vercel env', undefined, '', false],
    ['unset flag, Vercel preview build', undefined, 'preview', false],
    ['unset flag, Vercel development build', undefined, 'development', false],
    ['unset flag, Vercel production build', undefined, 'production', true],
    ['explicit on, anywhere', 'on', undefined, true],
    ['explicit on is case/space tolerant', ' ON ', 'preview', true],
    ['explicit off beats a production build', 'off', 'production', false],
    ['an unrecognised flag falls back to the environment (preview)', 'true', 'preview', false],
    ['an unrecognised flag falls back to the environment (production)', 'yes', 'production', true],
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
