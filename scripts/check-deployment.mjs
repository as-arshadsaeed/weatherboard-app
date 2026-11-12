/**
 * Read-only smoke check of a deployed WeatherBoard: `npm run check:deployment -- https://your-site`.
 *
 * It only sends GET requests (no credentials, cookies or tokens) and checks the things the Vercel header
 * rules in vercel.json are meant to guarantee. Run it against a preview URL first, then production.
 * Exit code 0 = every check passed, 1 = at least one failed. It does not test the service worker in a
 * browser; the manual checklist in the README covers that.
 */
const base = process.argv[2]
if (!base) {
  console.error('Usage: npm run check:deployment -- <https://deployment-url>')
  process.exit(2)
}
const root = new URL(base)
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(root.hostname)

const results = []
const record = (ok, name, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const note = (name, detail) => console.log(`NOTE  ${name} — ${detail}`)
const get = (path) => fetch(new URL(path, root), { redirect: 'manual', headers: { 'user-agent': 'weatherboard-deployment-check' } })
const cache = (res) => res.headers.get('cache-control') ?? '(none)'
const revalidates = (value) => /max-age=0|no-cache|no-store/.test(value) && !/immutable/.test(value)

async function checkShellFile(path, label, { type }) {
  const res = await get(path)
  record(res.status === 200, `${label} returns 200`, `got ${res.status}`)
  if (res.status !== 200) return null
  record(type.test(res.headers.get('content-type') ?? ''), `${label} has the right content type`, res.headers.get('content-type') ?? '(none)')
  record(revalidates(cache(res)), `${label} revalidates (never served stale)`, cache(res))
  return res
}

if (!isLocal) record(root.protocol === 'https:', 'served over HTTPS', root.protocol)

const home = await checkShellFile('/', 'index.html (/)', { type: /text\/html/ })
let html = ''
if (home) {
  html = await home.text()
  for (const [header, expected] of [
    ['x-content-type-options', /nosniff/],
    ['referrer-policy', /.+/],
    ['x-frame-options', /deny|sameorigin/i],
    ['permissions-policy', /.+/],
  ]) {
    const value = home.headers.get(header) ?? ''
    record(expected.test(value), `security header ${header}`, value || '(missing)')
  }
}

const asset = html.match(/\/assets\/[^"']+\.js/)?.[0]
if (asset) {
  const res = await get(asset)
  record(res.status === 200, `fingerprinted asset ${asset} returns 200`, `got ${res.status}`)
  record(/text\/javascript|application\/javascript/.test(res.headers.get('content-type') ?? ''), 'asset has a JavaScript content type', res.headers.get('content-type') ?? '(none)')
  const maxAge = Number(cache(res).match(/max-age=(\d+)/)?.[1] ?? 0)
  record(/immutable/.test(cache(res)) && maxAge >= 31536000, 'asset is cached for a year and immutable', cache(res))
} else {
  record(false, 'index.html references a fingerprinted /assets/ script')
}

const sw = await checkShellFile('/sw.js', 'service worker /sw.js', { type: /javascript/ })
await checkShellFile('/sw-notifications.js', 'worker import /sw-notifications.js', { type: /javascript/ })
if (sw) {
  const code = await sw.text()
  record(!/api\.open-meteo\.com|geocoding-api\.open-meteo|wft-geo-db/.test(code), 'service worker contains no weather or geocoding URLs (weather is never cached by the worker)')
}

const manifestRes = await checkShellFile('/manifest.webmanifest', 'manifest', { type: /manifest\+json|application\/json/ })
if (manifestRes) {
  let manifest = null
  try {
    manifest = await manifestRes.json()
  } catch {
    /* reported below */
  }
  record(manifest?.name === 'WeatherBoard' && manifest?.display === 'standalone', 'manifest parses and names the app', manifest ? `${manifest.name}, ${manifest.display}` : 'not valid JSON')
  for (const icon of manifest?.icons ?? []) {
    const res = await get(icon.src)
    record(res.status === 200 && /image\/png/.test(res.headers.get('content-type') ?? ''), `manifest icon ${icon.src} (${icon.sizes})`, `${res.status} ${res.headers.get('content-type') ?? ''}`)
  }
}

const missing = await get(`/definitely-not-a-page-${Date.now()}`)
if (missing.status === 404) note('unknown paths', '404 as intended: WeatherBoard has one route (/), so there is no SPA rewrite')
else note('unknown paths', `returned ${missing.status}; a catch-all rewrite would also turn missing assets into HTML`)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed${failed ? `, ${failed} FAILED` : ''}.`)
process.exit(failed ? 1 : 0)
