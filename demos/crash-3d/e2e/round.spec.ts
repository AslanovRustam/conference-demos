import { expect, test } from '@playwright/test'
import { nextCrash, open, snap, waitPhase } from './helpers'

test('keyboard round: launch, cash out, payout credited', async ({ page }) => {
  await open(page)
  // the first key only wakes the stand when it is in its idle loop
  if ((await snap(page)).attract) await page.keyboard.press('Space')
  await nextCrash(page, 50)
  await page.keyboard.press('Space')
  await page.waitForFunction(() => window.__crash.snap().multiplier >= 1.5, null, { timeout: 60_000 })
  await page.keyboard.press('Space')
  const s = await snap(page)
  expect(s.phase).toBe('ejected')
  expect(s.payout).toBeGreaterThanOrEqual(150)
  expect(s.balance).toBe(10_000 - 100 + s.payout)
})

test('crash shows CRASHED and records red history', async ({ page }) => {
  await open(page)
  await nextCrash(page, 1.3)
  await page.keyboard.press('Space')
  await waitPhase(page, 'crashed')
  await expect(page.getByText('CRASHED @', { exact: true })).toBeVisible()
  await waitPhase(page, 'result', 'betting')
  const s = await snap(page)
  expect(s.history[0]).toEqual({ crash: 1.3, won: false })
  expect(s.balance).toBe(9_900)
  await expect(page.locator('.hud-history .chip[data-lost]').first()).toBeVisible()
})

test('touch spam never double-launches or goes negative @touch', async ({ page }) => {
  await open(page)
  const button = page.locator('.mb')
  const box = (await button.boundingBox())!
  let rounds = 0
  let lastPhase = (await snap(page)).phase
  for (let i = 0; i < 30; i++) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(150 + (i % 5) * 120)
    const s = await snap(page)
    if (s.phase === 'countdown' && lastPhase !== 'countdown') rounds++
    lastPhase = s.phase
    expect(s.balance).toBeGreaterThanOrEqual(0)
  }
  await waitPhase(page, 'betting')
  const s = await snap(page)
  expect(s.history.length).toBeLessThanOrEqual(rounds)
  expect(s.balance).toBeGreaterThanOrEqual(0)
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)
})
