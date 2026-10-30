import { expect, test } from '@playwright/test'
import { lobby, openLobby } from './helpers'

test('loading screen goes away and the HUD names the active cabinet', async ({ page }) => {
  await openLobby(page)
  await expect(page.getByTestId('loading')).toHaveCount(0)
  const s = await lobby(page)
  const slot = s.slots[s.activeIndex]
  const expected = slot.kind === 'game' ? slot.game.title : (slot.title ?? 'COMING SOON')
  await expect(page.getByTestId('hud-title')).toHaveText(expected)
  await page.screenshot({ path: 'test-results/hud.png' })
})

test('next button turns the carousel and updates the title', async ({ page }) => {
  await openLobby(page)
  const before = await page.getByTestId('hud-title').textContent()
  await page.getByTestId('next').click()
  expect((await lobby(page)).activeIndex).toBe(1)
  await expect(page.getByTestId('hud-title')).not.toHaveText(before!)
  await page.getByTestId('prev').click()
  expect((await lobby(page)).activeIndex).toBe(0)
})

test('mute button toggles', async ({ page }) => {
  await openLobby(page)
  const mute = page.getByTestId('mute')
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await mute.click()
  await expect(mute).toHaveAttribute('aria-pressed', 'true')
  expect((await lobby(page)).muted).toBe(true)
})

test('HUD hides outside the lobby phase', async ({ page }) => {
  await openLobby(page)
  await expect(page.getByTestId('hud')).toBeVisible()
  await page.evaluate(() => (window as any).__lobby.setState({ phase: 'entering' }))
  await expect(page.getByTestId('hud')).toBeHidden()
})
