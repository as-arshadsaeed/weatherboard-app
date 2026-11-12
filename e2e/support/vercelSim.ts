import { readFile, readdir } from 'node:fs/promises'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

/**
 * TEST-ONLY static server that applies the header rules in vercel.json to the built `dist/`.
 *
 * It is a SIMULATION of Vercel's header behaviour, not Vercel: it checks that our rules match the files we
 * ship and that the app works when served with them. It cannot show what Vercel's edge actually sends (that
 * is what `npm run check:deployment -- <url>` is for). Matching is deliberately limited to the patterns
 * vercel.json uses (literal paths and `(.*)`), and it throws on anything else rather than guess.
 * Like the real deployment, there is no SPA rewrite: unknown paths are 404.
 */
const ROOT = path.resolve(import.meta.dirname, '../../')
export const DIST = path.join(ROOT, 'dist')

interface HeaderRule {
  source: string
  headers: Array<{ key: string; value: string }>
}

export async function loadHeaderRules(): Promise<HeaderRule[]> {
  const config = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8')) as { headers?: HeaderRule[] }
  return config.headers ?? []
}

function matches(source: string, pathname: string): boolean {
  if (/[:*+?]/.test(source.replace(/\(\.\*\)/g, ''))) {
    throw new Error(`vercelSim does not understand the pattern "${source}"`)
  }
  return new RegExp(`^${source}$`).test(pathname)
}

/** Headers Vercel would add for this path; rules that match are merged, later ones winning ties. */
export function headersFor(rules: HeaderRule[], pathname: string): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const rule of rules) {
    if (!matches(rule.source, pathname)) continue
    for (const { key, value } of rule.headers) merged[key.toLowerCase()] = value
  }
  return merged
}

/** Every file in dist as a URL path ("/assets/x.js", "/sw.js", …). */
export async function distPaths(dir = DIST, prefix = ''): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...(await distPaths(path.join(dir, entry.name), url)))
    else out.push(url)
  }
  return out
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
}

export async function startVercelSim(): Promise<{ url: string; close: () => Promise<void> }> {
  const rules = await loadHeaderRules()
  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://sim')
    const file = pathname === '/' ? '/index.html' : pathname
    const target = path.join(DIST, path.normalize(file))
    if (!target.startsWith(DIST + path.sep)) {
      res.writeHead(400).end()
      return
    }
    try {
      const body = await readFile(target)
      res.writeHead(200, {
        'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream',
        ...headersFor(rules, pathname),
      })
      res.end(body)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('The page could not be found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
