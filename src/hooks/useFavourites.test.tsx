import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFavourites } from '@/hooks/useFavourites'
import { isStoragePersistent, resetStorageStateForTests } from '@/services/storageService'
import { berlin, london, londonFromOtherProvider, madrid, paris, rome, tokyo } from '@/test/cities'

const stored = () => JSON.parse(window.localStorage.getItem('weatherboard:favourites') ?? 'null')

beforeEach(() => resetStorageStateForTests())

describe('useFavourites: adding and removing', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useFavourites())
    expect(result.current.favourites).toEqual([])
    expect(result.current.isFull).toBe(false)
  })

  it('adds a city and persists it', () => {
    const { result } = renderHook(() => useFavourites())
    let outcome = ''
    act(() => {
      outcome = result.current.add(london)
    })
    expect(outcome).toBe('added')
    expect(result.current.favourites).toEqual([london])
    expect(result.current.isFavourite(london)).toBe(true)
    expect(stored()).toEqual([london])
  })

  it('removes a city and persists the removal', () => {
    const { result } = renderHook(() => useFavourites())
    act(() => void result.current.add(london))
    act(() => void result.current.add(paris))
    act(() => result.current.remove(london))
    expect(result.current.favourites).toEqual([paris])
    expect(result.current.isFavourite(london)).toBe(false)
    expect(stored()).toEqual([paris])
  })

  it('preserves the order cities were saved in', () => {
    const { result } = renderHook(() => useFavourites())
    act(() => void result.current.add(tokyo))
    act(() => void result.current.add(london))
    act(() => void result.current.add(paris))
    expect(result.current.favourites.map((c) => c.name)).toEqual(['Tokyo', 'London', 'Paris'])
  })
})

describe('useFavourites: the limit of five', () => {
  function fillToFive() {
    const hook = renderHook(() => useFavourites())
    for (const city of [london, paris, tokyo, berlin, madrid]) act(() => void hook.result.current.add(city))
    return hook
  }

  it('accepts exactly five', () => {
    const { result } = fillToFive()
    expect(result.current.favourites).toHaveLength(5)
    expect(result.current.isFull).toBe(true)
  })

  it('refuses a sixth and leaves the list and storage unchanged', () => {
    const { result } = fillToFive()
    let outcome = ''
    act(() => {
      outcome = result.current.add(rome)
    })
    expect(outcome).toBe('full')
    expect(result.current.favourites).toHaveLength(5)
    expect(result.current.isFavourite(rome)).toBe(false)
    expect(stored()).toHaveLength(5)
  })

  it('allows adding again once one is removed', () => {
    const { result } = fillToFive()
    act(() => result.current.remove(madrid))
    expect(result.current.isFull).toBe(false)
    act(() => void result.current.add(rome))
    expect(result.current.favourites).toHaveLength(5)
    expect(result.current.isFavourite(rome)).toBe(true)
  })
})

describe('useFavourites: duplicates', () => {
  it('rejects the same city by id', () => {
    const { result } = renderHook(() => useFavourites())
    act(() => void result.current.add(london))
    let outcome = ''
    act(() => {
      outcome = result.current.add({ ...london })
    })
    expect(outcome).toBe('duplicate')
    expect(result.current.favourites).toHaveLength(1)
  })

  it('rejects the same place reported by another provider (different id, same coordinates)', () => {
    const { result } = renderHook(() => useFavourites())
    act(() => void result.current.add(london))
    let outcome = ''
    act(() => {
      outcome = result.current.add(londonFromOtherProvider)
    })
    expect(outcome).toBe('duplicate')
    expect(result.current.favourites).toHaveLength(1)
    expect(result.current.isFavourite(londonFromOtherProvider)).toBe(true)
  })

  it('removing by the other provider’s record removes the same favourite', () => {
    const { result } = renderHook(() => useFavourites())
    act(() => void result.current.add(london))
    act(() => result.current.remove(londonFromOtherProvider))
    expect(result.current.favourites).toEqual([])
  })

  it('does not confuse different cities that share a name', () => {
    const { result } = renderHook(() => useFavourites())
    act(() => void result.current.add(london))
    let outcome = ''
    act(() => {
      outcome = result.current.add({ ...london, id: 'geodb:9', region: 'Ontario', country: 'Canada', latitude: 42.98, longitude: -81.23 })
    })
    expect(outcome).toBe('added')
    expect(result.current.favourites).toHaveLength(2)
  })
})

describe('useFavourites: persistence', () => {
  it('survives a reload (fresh mount reads storage)', () => {
    const first = renderHook(() => useFavourites())
    act(() => void first.result.current.add(london))
    act(() => void first.result.current.add(tokyo))
    first.unmount()

    const second = renderHook(() => useFavourites())
    expect(second.result.current.favourites).toEqual([london, tokyo])
  })

  it.each(['{not json', '"london"', '42', 'null', '{"a":1}'])('ignores corrupted storage (%s)', (raw) => {
    window.localStorage.setItem('weatherboard:favourites', raw)
    const { result } = renderHook(() => useFavourites())
    expect(result.current.favourites).toEqual([])
  })

  it('keeps the valid entries of a partly corrupted list', () => {
    window.localStorage.setItem('weatherboard:favourites', JSON.stringify([london, { nope: true }, null, { ...paris, latitude: 999 }, tokyo]))
    const { result } = renderHook(() => useFavourites())
    expect(result.current.favourites.map((c) => c.name)).toEqual(['London', 'Tokyo'])
  })

  it('never loads more than five, nor duplicates, from storage', () => {
    window.localStorage.setItem('weatherboard:favourites', JSON.stringify([london, london, londonFromOtherProvider, paris, tokyo, berlin, madrid, rome]))
    const { result } = renderHook(() => useFavourites())
    expect(result.current.favourites.map((c) => c.name)).toEqual(['London', 'Paris', 'Tokyo', 'Berlin', 'Madrid'])
  })
})

describe('useFavourites: storage unavailable', () => {
  function blockStorage() {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
  }

  it('keeps working in memory for the session and reports that nothing persists', () => {
    blockStorage()
    const { result } = renderHook(() => useFavourites())
    expect(result.current.favourites).toEqual([])

    act(() => void result.current.add(london))
    act(() => void result.current.add(paris))
    expect(result.current.favourites).toEqual([london, paris])
    act(() => result.current.remove(london))
    expect(result.current.favourites).toEqual([paris])
    expect(isStoragePersistent()).toBe(false)
  })

  it('still enforces the limit and duplicate rules', () => {
    blockStorage()
    const { result } = renderHook(() => useFavourites())
    for (const city of [london, paris, tokyo, berlin, madrid]) act(() => void result.current.add(city))
    let full = ''
    let dup = ''
    act(() => {
      full = result.current.add(rome)
      dup = result.current.add(londonFromOtherProvider)
    })
    expect(full).toBe('full')
    expect(dup).toBe('duplicate')
  })
})
