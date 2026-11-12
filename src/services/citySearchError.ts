import { RequestError } from '@/services/http'

export type CitySearchErrorKind = 'network' | 'timeout' | 'rate-limited' | 'unavailable' | 'bad-response'

/** Written for non-technical users (spec §4.3). */
const MESSAGES: Record<CitySearchErrorKind, string> = {
  network: 'Unable to search cities. Check your internet connection and try again.',
  timeout: 'City search is taking too long. Check your connection and try again.',
  'rate-limited': 'City search is temporarily unavailable. Please try again.',
  unavailable: 'City search is temporarily unavailable. Please try again.',
  'bad-response': 'City search is temporarily unavailable. Please try again.',
}

export class CitySearchError extends Error {
  readonly kind: CitySearchErrorKind

  constructor(kind: CitySearchErrorKind, options?: { cause?: unknown }) {
    super(MESSAGES[kind], options)
    this.name = 'CitySearchError'
    this.kind = kind
  }
}

export function fromRequestError(error: RequestError): CitySearchError {
  switch (error.kind) {
    case 'network':
      return new CitySearchError('network', { cause: error })
    case 'timeout':
      return new CitySearchError('timeout', { cause: error })
    case 'invalid-json':
      return new CitySearchError('bad-response', { cause: error })
    case 'http-error':
      return new CitySearchError(error.status === 429 ? 'rate-limited' : 'unavailable', {
        cause: error,
      })
  }
}

/** Normalise anything thrown while searching into a CitySearchError. */
export function toCitySearchError(error: unknown): CitySearchError {
  if (error instanceof CitySearchError) return error
  if (error instanceof RequestError) return fromRequestError(error)
  return new CitySearchError('unavailable', { cause: error })
}
