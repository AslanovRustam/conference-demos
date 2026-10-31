import { expect, test, type Page } from '@playwright/test'
import { nextCrash, open, snap, waitPhase } from './helpers'

async function buttonInside(page: Page) {
  const button = page.locator('.mb')
  await expect(button).toBeVisible()
  const box = (await button.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
}

test('portrait and landscape keep the main button visible and inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await buttonInside(page)
  for (const size of [{ width: 844, height: 390 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(300)
    await buttonInside(page)
  }
})

test('rotating mid-flight keeps the round going and the layout valid', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await nextCrash(page, 50)
  await page.keyboard.press('Space')
  await waitPhase(page, 'flight')
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(500)
  expect((await snap(page)).phase).toBe('flight')
  await buttonInside(page)
})

test('no pinch zoom or page gestures anywhere: touch-action none on the page', async ({ page }) => {
  await open(page)
  const actions = await page.evaluate(() => ['html', 'body', '#root'].map((s) => getComputedStyle(document.querySelector(s)!).touchAction))
  expect(actions).toEqual(['none', 'none', 'none'])
})
