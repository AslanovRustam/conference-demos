import { expect, test } from '@playwright/test'

test('the hall renders without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/hall.png' })
  expect(errors).toEqual([])
})

test('the carousel is filled with at least six cabinets', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as any).__lobby.getState().phase)).toBe('lobby')
  const count = await page.evaluate(() => (window as any).__lobby.getState().slots.length)
  expect(count).toBeGreaterThanOrEqual(6)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/carousel.png' })
})
