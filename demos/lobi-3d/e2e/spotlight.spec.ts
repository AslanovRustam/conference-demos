import { expect, test } from '@playwright/test'
import { openLobby } from './helpers'

test('the front spotlight is aimed at the active cabinet, not the hall centre', async ({ page }) => {
  await openLobby(page)
  const target = await page.evaluate(() => {
    const scene = (window as any).__three.scene
    const spot = scene.getObjectByName('front-spot')
    const e = spot.target.matrixWorld.elements
    return [e[12], e[13], e[14]]
  })
  expect(target[2]).toBeGreaterThan(3.5) // the front cabinet stands at z ≈ RADIUS
  expect(target[1]).toBeGreaterThan(0.5)
})
