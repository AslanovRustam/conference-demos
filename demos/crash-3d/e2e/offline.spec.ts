import { expect, test } from '@playwright/test'
import { nextCrash, open, waitPhase } from './helpers'

test('no external network requests and no console errors', async ({ page }) => {
  const external: string[] = []
  const errors: string[] = []
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname
    if (!['127.0.0.1', 'localhost'].includes(host) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url())
  })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page)
  // a full round: liftoff, cash out, the crash and the result
  await nextCrash(page, 2.5)
  await page.keyboard.press('Space')
  await page.waitForFunction(() => window.__crash.snap().multiplier >= 1.4, null, { timeout: 60_000 })
  await page.keyboard.press('Space')
  await waitPhase(page, 'crashed')
  await waitPhase(page, 'betting')
  expect(external).toEqual([])
  expect(errors).toEqual([])
})
