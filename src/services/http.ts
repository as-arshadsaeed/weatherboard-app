/**
 * Shared JSON request helper: timeout + caller cancellation + classified failures.
 * Callers map `RequestError` to their own user-facing errors.
 */

export type RequestFailureKind = 'network' | 'timeout' | 'http-error' | 'invalid-json'

export class RequestError extends Error {
  readonly kind: RequestFailureKind
  readonly status?: number

  constructor(kind: RequestFailureKind, options?: { status?: number; cause?: unknown }) {
    super(`Request failed: ${kind}${options?.status ? ` (${options.status})` : ''}`, {
      cause: options?.cause,
    })
    this.name = 'RequestError'
    this.kind = kind
    this.status = options?.status
  }
}

/** Matches by name rather than `instanceof` so it also works for errors from another realm. */
function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'TimeoutError'
  )
}

export interface RequestJsonOptions {
  /** Abort to cancel an outdated request. Aborts are re-thrown as-is, never classified as failures. */
  signal?: AbortSignal
  timeoutMs: number
  headers?: Record<string, string>
}

export async function requestJson(
  url: string,
  { signal, timeoutMs, headers }: RequestJsonOptions,
): Promise<unknown> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  let response: Response
  try {
    response = await fetch(url, headers ? { signal: combined, headers } : { signal: combined })
  } catch (error) {
    if (signal?.aborted) throw error
    if (isTimeoutError(error)) throw new RequestError('timeout', { cause: error })
    throw new RequestError('network', { cause: error })
  }

  if (!response.ok) throw new RequestError('http-error', { status: response.status })

  try {
    return await response.json()
  } catch (error) {
    if (signal?.aborted) throw error
    if (isTimeoutError(error)) throw new RequestError('timeout', { cause: error })
    throw new RequestError('invalid-json', { cause: error })
  }
}
