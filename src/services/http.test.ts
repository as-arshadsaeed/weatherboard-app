import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestError, requestJson } from '@/services/http'
import { jsonResponse } from '@/test/fixtures/openMeteo'

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const never = (_url: string, init: RequestInit) =>
  new Promise<Response>((_res, rej) => init.signal?.addEventListener('abort', () => rej(init.signal?.reason)))

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the promise to reject')
}

describe('requestJson', () => {
  it('returns parsed JSON on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    expect(await requestJson('https://example.test/x', { timeoutMs: 1000 })).toEqual({ ok: true })
  })

  it('passes custom headers through, and omits them when none are given', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})))
    await requestJson('https://example.test/x', { timeoutMs: 1000, headers: { 'X-Test': '1' } })
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual({ 'X-Test': '1' })
    await requestJson('https://example.test/x', { timeoutMs: 1000 })
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toBeUndefined()
  })

  it('classifies a failed fetch as "network"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await errorOf(requestJson('https://example.test/x', { timeoutMs: 1000 }))).toMatchObject({
      name: 'RequestError',
      kind: 'network',
    })
  })

  it('classifies non-2xx responses as "http-error" and keeps the status', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }))
    expect(await errorOf(requestJson('https://example.test/x', { timeoutMs: 1000 }))).toMatchObject({
      kind: 'http-error',
      status: 429,
    })
  })

  it('classifies an unparsable body as "invalid-json"', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }))
    expect(await errorOf(requestJson('https://example.test/x', { timeoutMs: 1000 }))).toMatchObject({
      kind: 'invalid-json',
    })
  })

  it('classifies a stalled request as "timeout"', async () => {
    fetchMock.mockImplementation(never)
    expect(await errorOf(requestJson('https://example.test/x', { timeoutMs: 20 }))).toMatchObject({
      kind: 'timeout',
    })
  })

  it('re-throws a caller abort untouched, never as a RequestError', async () => {
    fetchMock.mockImplementation(never)
    const controller = new AbortController()
    const pending = errorOf(requestJson('https://example.test/x', { timeoutMs: 5000, signal: controller.signal }))
    controller.abort()
    const error = await pending
    expect(error).not.toBeInstanceOf(RequestError)
  })
})
