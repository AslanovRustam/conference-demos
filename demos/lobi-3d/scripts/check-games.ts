// Opens the built site (dist/) in headless Chrome: the lobby page and every game the manifest
// says was built. Reports failed responses (>= 400), requests outside the game's own folder
// and off-origin requests, and games that never draw a canvas. Warnings only; --strict exits 1.
// Run: node scripts/check-games.ts [--strict]
import { chromium } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import type { GamesManifest } from './lib/games-build.ts'
import { classifyRequest } from './lib/requests.ts'

const PORT = 4291
const CANVAS_TIMEOUT_MS = 15000

const lobbyDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(lobbyDir, 'dist', 'games', 'manifest.json')
const strict = process.argv.includes('--strict')

if (!existsSync(path.join(lobbyDir, 'dist', 'index.html'))) {
  console.error('check-games: dist/ is missing, run `npm run build` first')
  process.exit(1)
}
const manifest: GamesManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { builtAt: '', games: {} }
const games = Object.entries(manifest.games)
  .filter(([, g]) => g.ok)
  .map(([id]) => id)

const server = await preview({ root: lobbyDir, preview: { port: PORT, strictPort: true }, logLevel: 'error' })
const origin = `http://localhost:${PORT}`
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

let warnings = 0
async function check(label: string, url: string, gameId: string | null) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const problems: string[] = []
  page.on('request', (r) => {
    const kind = classifyRequest(r.url(), gameId, origin)
    if (kind !== 'ok') problems.push(`${kind}: ${r.url()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`)
  })
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
  await page.goto(origin + url)
  try {
    await page.waitForSelector('canvas', { timeout: CANVAS_TIMEOUT_MS })
  } catch {
    problems.push(`no canvas within ${CANVAS_TIMEOUT_MS / 1000} s`)
  }
  await page.waitForTimeout(1500)
  await page.close()
  warnings += problems.length
  console.log(problems.length ? `  WARN ${label}` : `  OK   ${label}`)
  for (const p of problems) console.log(`         ${p}`)
}

console.log(`Checking ${origin}`)
await check('lobby', '/', null)
for (const id of games) await check(id, `/games/${id}/?embed=1`, id)
const skipped = Object.entries(manifest.games).filter(([, g]) => !g.ok)
for (const [id, g] of skipped) console.log(`  SKIP ${id} (${g.reason})`)

await browser.close()
await server.close()
process.exit(strict && warnings > 0 ? 1 : 0)
