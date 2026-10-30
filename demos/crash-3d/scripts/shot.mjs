// usage: npm run shot -- "<query>" <out.png> [--portrait] [--base <url>] [--eval "<js>"] [--at <seconds>]
// --eval runs a script in the page once it is ready (awaited if it returns a promise), --at waits that long
// afterwards before the frame (default 1 s)
// needs a running dev server; the frame is taken once window.__crashReady === true
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium } from '@playwright/test'

const argv = process.argv.slice(2)
if (argv.includes('--help')) {
  console.log('npm run shot -- "<query>" <out.png> [--portrait] [--base <url>] [--eval "<js>"] [--at <seconds>]')
  process.exit(0)
}

const portrait = argv.includes('--portrait')
const flag = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? { i, value: argv[i + 1] } : null
}
const baseIdx = argv.indexOf('--base')
const evalArg = flag('--eval')
const atArg = flag('--at')
// 127.0.0.1, not localhost: localhost may resolve to ::1 where another app listens
const base = baseIdx >= 0 ? argv[baseIdx + 1] : 'http://127.0.0.1:5183/'
const skip = new Set([baseIdx, evalArg?.i, atArg?.i].filter((i) => i !== undefined && i >= 0).flatMap((i) => [i, i + 1]))
const [query = '', out = 'shots/shot.png'] = argv.filter((a, i) => !skip.has(i) && !a.startsWith('--'))

mkdirSync(dirname(out), { recursive: true })

// real Chrome with ANGLE/D3D11 so the scene renders on the GPU
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--force_high_performance_gpu'],
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
  if (evalArg) await page.evaluate(evalArg.value)
  await page.waitForTimeout(atArg ? Number(atArg.value) * 1000 : 1000)
  await page.screenshot({ path: out })
  console.log('saved', out)
} finally {
  await browser.close()
}
