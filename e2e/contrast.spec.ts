import { expect, test } from '@playwright/test'

/** [foreground token, background token, minimum ratio, what it is used for] */
const PAIRS: ReadonlyArray<[string, string, number, string]> = [
  ['foreground', 'background', 4.5, 'body text'],
  ['card-foreground', 'card', 4.5, 'card text'],
  ['muted-foreground', 'background', 4.5, 'secondary text on page'],
  ['muted-foreground', 'card', 4.5, 'secondary text / placeholder on cards'],
  ['muted-foreground', 'muted', 4.5, 'secondary text on muted chips'],
  ['primary-foreground', 'primary', 4.5, 'primary button'],
  ['brand', 'card', 3, 'brand icons / large UI (non-text 3:1)'],
  ['brand-foreground', 'brand', 4.5, 'brand fills'],
  ['destructive', 'card', 4.5, 'error text'],
  ['success', 'card', 4.5, 'success text'],
  ['warning', 'card', 4.5, 'warning text'],
]

for (const scheme of ['light', 'dark'] as const) {
  test(`design tokens meet WCAG contrast in ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')

    const ratios = await page.evaluate((pairs) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      const root = getComputedStyle(document.documentElement)

      // Resolve any CSS colour (incl. oklch) to sRGB via the canvas.
      const rgb = (token: string): [number, number, number] => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = root.getPropertyValue(`--${token}`).trim()
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        return [r!, g!, b!]
      }
      const luminance = ([r, g, b]: [number, number, number]) => {
        const lin = (c: number) => {
          const s = c / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      }
      return pairs.map(([fg, bg]) => {
        const [a, b] = [luminance(rgb(fg)), luminance(rgb(bg))]
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      })
    }, PAIRS)

    PAIRS.forEach(([fg, bg, min, usage], i) => {
      expect(ratios[i], `${fg} on ${bg} (${usage})`).toBeGreaterThanOrEqual(min)
    })
  })
}
