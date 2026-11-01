// Records a gameplay loop for every built game: serves .games-build at /games/, opens each game
// in headless Chrome on the real GPU with video recording, presses its play key now and then,
// and writes public/previews/<id>.webm, <id>.jpg and public/previews/index.json (which the lobby
// reads at startup). Re-run after the games change: npm run build:games && npm run record:previews
import { chromium } from '@playwright/test'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'
import type { GamesManifest } from './lib/games-build.ts'

const PORT = 4293
const SIZE = { width: 1280, height: 720 }
// the screen is ~300 px wide in the hall; a small video keeps decode and texture upload cheap
const VIDEO = { width: 640, height: 360 }
const RECORD_SEC = 15
/** key that starts a round in each game (spin, launch, drop); Space when not listed */
const PLAY_KEY: Record<string, string> = {}
const PLAY_EVERY_MS = 3500
/** per-game rhythm: crash launches, flies ~7 s (warp, clouds), then cashes out (capsule eject) */
const PLAY_EVERY: Record<string, number> = { 'crash-3d': 7000 }
/** games whose embed mode opens on a splash: the button to press (the opening itself goes into the loop) */
const INTRO_BUTTON: Record<string, RegExp> = { 'slot-3d': /open the vault/i }
/** games show their own loader after the canvas appears; the loop starts once it is gone */
const SETTLE_MS = 4500

const lobbyDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(lobbyDir, '.games-build')
const outDir = path.join(lobbyDir, 'public', 'previews')
const manifestPath = path.join(buildDir, 'manifest.json')

if (!existsSync(manifestPath)) {
  console.error('record-previews: no .games-build/manifest.json, run `npm run build:games` first')
  process.exit(1)
}
const manifest: GamesManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const config = JSON.parse(readFileSync(path.join(lobbyDir, 'games.config.json'), 'utf8')) as { games: { id: string; waitForReady?: boolean }[] }
const waitForReady = new Set(config.games.filter((g) => g.waitForReady).map((g) => g.id))
const games = Object.entries(manifest.games)
  .filter(([, g]) => g.ok)
  .map(([id]) => id)

const serveGames = sirv(buildDir, { dev: true })
const server = http.createServer((req, res) => {
  if (!req.url?.startsWith('/games/')) {
    res.statusCode = 404
    return res.end()
  }
  req.url = req.url.slice('/games'.length)
  serveGames(req, res, () => {
    res.statusCode = 404
    res.end()
  })
})
await new Promise<void>((resolve) => server.listen(PORT, resolve))

// the real GPU: software rendering would record a slideshow
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const tmp = mkdtempSync(path.join(os.tmpdir(), 'lobby-previews-'))
mkdirSync(outDir, { recursive: true })
const index: Record<string, { video: string; poster: string; start: number }> = {}

for (const id of games) {
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmp, size: VIDEO } })
  const page = await ctx.newPage()
  // opened top-level, a game's clickable:ready goes to its own window: catch it to start on time
  await page.addInitScript({
    content: "window.__ready=false;addEventListener('message',function(e){if(e.data&&e.data.type==='clickable:ready')window.__ready=true})",
  })
  const t0 = Date.now()
  await page.goto(`http://localhost:${PORT}/games/${id}/?embed=1`)
  try {
    await page.waitForSelector('canvas', { timeout: 20000 })
  } catch {
    console.warn(`  ${id}: no canvas, skipped`)
    await ctx.close()
    continue
  }
  // games that reliably announce ready (waitForReady in games.config.json) start a beat after it,
  // however long their scene takes to load; the others get the fixed settle time
  const announced = waitForReady.has(id) && (await page.waitForFunction('window.__ready === true', null, { timeout: 45000 }).then(() => true, () => false))
  if (waitForReady.has(id) && !announced) console.warn(`  ${id}: no clickable:ready within 45 s`)
  await page.waitForTimeout(announced ? 1500 : SETTLE_MS)
  const start = (Date.now() - t0) / 1000
  const intro = INTRO_BUTTON[id]
  if (intro) {
    // force: splash buttons pulse forever and never count as "stable" for a normal click
    await page.getByRole('button', { name: intro }).click({ timeout: 5000, force: true }).catch(() => console.warn(`  ${id}: no ${intro} button`))
    await page.waitForTimeout(2500)
  }
  const key = PLAY_KEY[id] ?? 'Space'
  const end = Date.now() + RECORD_SEC * 1000
  let posterTaken = false
  while (Date.now() < end) {
    await page.keyboard.press(key)
    await page.waitForTimeout(PLAY_EVERY[id] ?? PLAY_EVERY_MS)
    if (!posterTaken && Date.now() > end - (RECORD_SEC * 1000) / 2) {
      await page.screenshot({ path: path.join(outDir, `${id}.jpg`), type: 'jpeg', quality: 82 })
      posterTaken = true
    }
  }
  const video = page.video()
  await ctx.close()
  if (video) copyFileSync(await video.path(), path.join(outDir, `${id}.webm`))
  index[id] = { video: `previews/${id}.webm`, poster: `previews/${id}.jpg`, start: Math.round(start * 10) / 10 }
  console.log(`  ${id}: recorded, loop starts at ${index[id].start}s`)
}

writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
await browser.close()
server.close()
rmSync(tmp, { recursive: true, force: true })
