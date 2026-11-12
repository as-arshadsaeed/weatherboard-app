import type { Page } from '@playwright/test'

/**
 * Page-side measurements shared by the accessibility and responsive specs. Everything here reads the
 * real rendered page (rects, computed styles, hit-testing) rather than inferring from class names.
 */

export const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

export const MIN_TARGET_PX = 44

export interface SmallTarget {
  target: string
  width: number
  height: number
}

/** Interactive elements on screen that are smaller than 44 × 44 CSS px. */
export async function findSmallTargets(page: Page, min = MIN_TARGET_PX): Promise<SmallTarget[]> {
  return page.evaluate((minimum) => {
    const selector =
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=option], [role=checkbox], [tabindex]:not([tabindex="-1"])'
    const found: SmallTarget[] = []
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (style.visibility === 'hidden' || style.display === 'none') continue
      // Visually hidden helpers (e.g. the skip link until focused) are measured by their own test.
      if (rect.width <= 1 || rect.height <= 1) continue
      if (el.closest('[inert]')) continue
      if (rect.width < minimum - 0.5 || rect.height < minimum - 0.5) {
        const label =
          el.getAttribute('aria-label') ?? el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40)
        found.push({
          target: `${el.tagName.toLowerCase()}[${label ?? ''}]`,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })
      }
    }
    return found
  }, min)
}

export interface FocusStop {
  target: string
  /** A visible outline (or ring-like shadow) is drawn. */
  hasIndicator: boolean
  /** Name of an ancestor whose overflow would cut the focus ring off, if any. */
  clippedBy: string | null
  /** Hit-tested points (of 9) inside the element that actually reach it, i.e. are not covered. */
  reachablePointsOf9: number
}

/** Press Tab up to `maxStops` times and describe every element that receives focus. */
export async function walkFocusOrder(page: Page, maxStops = 70): Promise<FocusStop[]> {
  await page.mouse.move(0, 0)
  // In a modal dialog, start on its first control; otherwise start from the top of the page.
  const inDialog = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]')
    const first = dialog?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (first) {
      first.focus()
      return true
    }
    // Reset the browser's sequential-focus starting point (blur() alone leaves it on the last clicked control).
    document.body.setAttribute('tabindex', '-1')
    document.body.focus()
    document.body.removeAttribute('tabindex')
    return false
  })
  // A scripted focus() does not count as keyboard focus; tabbing away and back does, so :focus-visible applies.
  if (inDialog) {
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
  }
  const stops: FocusStop[] = []
  const seen = new Set<string>()
  for (let i = 0; i < maxStops; i++) {
    if (i > 0 || !inDialog) await page.keyboard.press('Tab')
    const stop = await page.evaluate((): (FocusStop & { id: string }) | null => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      const outlineWidth = parseFloat(style.outlineWidth) || 0
      const outlineOffset = parseFloat(style.outlineOffset) || 0
      const hasIndicator =
        (style.outlineStyle !== 'none' && outlineWidth > 0) ||
        (style.boxShadow !== 'none' && /rgb/.test(style.boxShadow))
      // Only the part of the ring that sticks out of the element can be clipped.
      // An inset ring (negative offset) stays inside the element, so it can reach out by less, or not at all.
      const reach = Math.max(0, outlineWidth + outlineOffset)

      let clippedBy: string | null = null
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const ps = getComputedStyle(p)
        const clipsX = ps.overflowX !== 'visible'
        const clipsY = ps.overflowY !== 'visible'
        if (!clipsX && !clipsY) continue
        const pr = p.getBoundingClientRect()
        const cutX = clipsX && (rect.left - reach < pr.left - 0.5 || rect.right + reach > pr.right + 0.5)
        const cutY = clipsY && (rect.top - reach < pr.top - 0.5 || rect.bottom + reach > pr.bottom + 0.5)
        if (cutX || cutY) {
          clippedBy = `${p.tagName.toLowerCase()}.${String(p.className).split(' ').slice(0, 3).join('.')}`
          break
        }
      }

      let reachable = 0
      for (const fx of [0.15, 0.5, 0.85]) {
        for (const fy of [0.15, 0.5, 0.85]) {
          const x = rect.left + rect.width * fx
          const y = rect.top + rect.height * fy
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
          const hit = document.elementFromPoint(x, y)
          if (hit && (hit === el || el.contains(hit) || hit.contains(el))) reachable++
        }
      }

      const label = el.getAttribute('aria-label') ?? el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 36)
      const target = `${el.tagName.toLowerCase()}[${label ?? ''}]`
      return { id: `${target}@${Math.round(rect.left)},${Math.round(rect.top)}`, target, hasIndicator, clippedBy, reachablePointsOf9: reachable }
    })
    if (!stop || seen.has(stop.id)) break // focus left the page or wrapped around
    seen.add(stop.id)
    stops.push({ target: stop.target, hasIndicator: stop.hasIndicator, clippedBy: stop.clippedBy, reachablePointsOf9: stop.reachablePointsOf9 })
  }
  return stops
}
