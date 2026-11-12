import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { VIEWPORTS } from './support/audit.ts'
import { STATES } from './support/states.ts'

/**
 * Automated WCAG 2.2 AA scan (axe-core) of every reachable screen state, at the three required widths and
 * in both themes. axe finds roughly a third of accessibility problems; the specs next to this one cover
 * what it cannot (focus, target size, reflow, motion), and none of it replaces testing with a screen reader.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

for (const viewport of VIEWPORTS) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`axe: ${viewport.name} ${scheme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: scheme })

      for (const state of STATES) {
        if (state.phoneOnly && viewport.width >= 768) continue
        test(state.name, async ({ page, context }) => {
          await state.setup(page, context)
          await page.mouse.move(0, 0) // no hover styling in the scan
          const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
          expect(
            violations.map((v) => ({ rule: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })),
          ).toEqual([])
        })
      }
    })
  }
}
