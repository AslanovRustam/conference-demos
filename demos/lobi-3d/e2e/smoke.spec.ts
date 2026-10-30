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
