// usage: npm run shot -- "<query>" <out.png> [--portrait] [--base <url>]
// needs a running dev server; the frame is taken once window.__crashReady === true
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium } from '@playwright/test'

const argv = process.argv.slice(2)
if (argv.includes('--help')) {
  console.log('npm run shot -- "<query>" <out.png> [--portrait] [--base <url>]')
  process.exit(0)
}

const portrait = argv.includes('--portrait')
const baseIdx = argv.indexOf('--base')
const base = baseIdx >= 0 ? argv[baseIdx + 1] : 'http://localhost:5173/'
const skip = new Set(baseIdx >= 0 ? [baseIdx, baseIdx + 1] : [])
const [query = '', out = 'shots/shot.png'] = argv.filter((a, i) => !skip.has(i) && !a.startsWith('--'))

mkdirSync(dirname(out), { recursive: true })

// real Chrome with ANGLE/D3D11 so the scene renders on the GPU
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'],
})
try {
  const context = await browser.newContext(
    portrait
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  )
  const page = await context.newPage()
  await page.goto(base + query)
  await page.waitForFunction(() => window.__crashReady === true, null, { timeout: 60_000 })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: out })
  console.log('saved', out)
} finally {
  await browser.close()
}
