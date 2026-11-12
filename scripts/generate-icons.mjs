/**
 * Renders the app icons from the WeatherBoard mark (sun behind a cloud, same artwork as favicon.svg).
 * Uses the Chromium that Playwright already installs, so no image library is needed.
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes public/icons/: icon-192.png, icon-512.png (purpose "any"), icon-maskable-512.png
 * (full-bleed, content inside the 80% safe zone) and apple-touch-icon.png (180 px, full-bleed).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from '@playwright/test'

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const BG = '#12141c'
const SUN = '#fbbf24'
const CLOUD = '#f4f6fb'

// Artwork in the 32-unit box used by favicon.svg.
const MARK = `
  <circle cx="20.5" cy="12.5" r="5.5" fill="${SUN}"/>
  <path d="M9.5 24.5a4.5 4.5 0 0 1-.6-8.96A6.5 6.5 0 0 1 21.4 17.1 3.7 3.7 0 0 1 21 24.5Z" fill="${CLOUD}"/>`

/** `rounded`: rounded-square tile on transparency (purpose "any"). Otherwise full-bleed square. */
function svg({ rounded, scale = 1 }) {
  // Scale the mark about the centre of the 32-unit box (content is roughly centred there).
  const t = `translate(16 16) scale(${scale}) translate(-16 -16)`
  const bg = rounded
    ? `<rect width="32" height="32" rx="9" fill="${BG}"/>`
    : `<rect width="32" height="32" fill="${BG}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${bg}<g transform="${t}">${MARK}</g></svg>`
}

const ICONS = [
  { file: 'icon-192.png', size: 192, art: svg({ rounded: true, scale: 1.12 }), transparent: true },
  { file: 'icon-512.png', size: 512, art: svg({ rounded: true, scale: 1.12 }), transparent: true },
  // Maskable: the platform crops to a circle/squircle, so keep the mark well inside the safe zone.
  { file: 'icon-maskable-512.png', size: 512, art: svg({ rounded: false, scale: 1 }), transparent: false },
  { file: 'apple-touch-icon.png', size: 180, art: svg({ rounded: false, scale: 1.12 }), transparent: false },
]

await mkdir(OUT_DIR, { recursive: true })
const browser = await chromium.launch()
try {
  for (const { file, size, art, transparent } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`,
    )
    const png = await page.screenshot({ omitBackground: transparent, type: 'png' })
    await writeFile(path.join(OUT_DIR, file), png)
    console.log(`wrote ${file} (${size}x${size}, ${png.length} bytes)`)
    await page.close()
  }
} finally {
  await browser.close()
}
