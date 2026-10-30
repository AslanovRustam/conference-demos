import { expect, test, type Page } from '@playwright/test'
import { lobby, openLobby } from './helpers'

// Headless Chrome renders WebGL in software (SwiftShader); at 1080p the lobby plus the game
// canvas can stall the main thread for seconds. A smaller window keeps the flow tests about
// behaviour, not about the CI machine's fill rate.
test.use({ viewport: { width: 1280, height: 720 } })
const REVEAL = { timeout: 30_000 }

async function testGameNumber(page: Page): Promise<number> {
  const s = await lobby(page)
  return s.slots.filter((x: { kind: string }) => x.kind === 'game').findIndex((x: { game: { id: string } }) => x.game.id === 'test-game') + 1
}

async function openTestGame(page: Page, tg = '') {
  await openLobby(page, tg ? `?tg=${encodeURIComponent(tg)}` : '')
  const n = await testGameNumber(page)
  await page.evaluate((n) => (window as any).__lobby.getState().openGame(n), n)
}

const frame = (page: Page) => page.getByTestId('game-frame')
const phase = async (page: Page) => (await lobby(page)).phase
const gameFrame = (page: Page) => page.frames().find((f) => f.url().includes('/test-game/'))!

test('reveals the game and tells it it is visible', async ({ page }) => {
  await openTestGame(page)
  await expect(frame(page)).toHaveAttribute('data-revealed', 'true', REVEAL)
  expect(await phase(page)).toBe('playing')
  const received = await gameFrame(page).evaluate(() => (window as any).__received)
  expect(received).toContainEqual({ type: 'clickable:visible' })
})

test('exit button in game returns to lobby and keyboard works', async ({ page }) => {
  await openTestGame(page)
  await expect(frame(page)).toHaveAttribute('data-revealed', 'true', REVEAL)
  await page.frameLocator('[data-testid=game-frame]').locator('#exit').click()
  await expect(frame(page)).toHaveCount(0)
  await expect.poll(() => phase(page), REVEAL).toBe('lobby')
  const before = (await lobby(page)).activeIndex
  await page.keyboard.press('ArrowRight')
  expect((await lobby(page)).activeIndex).not.toBe(before)
})

test('Escape inside the game returns to lobby', async ({ page }) => {
  await openTestGame(page)
  await expect(frame(page)).toHaveAttribute('data-revealed', 'true', REVEAL)
  await page.frameLocator('[data-testid=game-frame]').locator('canvas').click({ position: { x: 900, y: 500 } })
  await page.keyboard.press('Escape')
  await expect.poll(() => phase(page), REVEAL).toBe('lobby')
})

test('game without ready is revealed by the probe', async ({ page }) => {
  await openTestGame(page, 'noready=1')
  await expect(frame(page)).toHaveAttribute('data-revealed', 'true', REVEAL)
})

test('double Enter opens one frame', async ({ page }) => {
  await openLobby(page)
  const s = await lobby(page)
  const index = s.slots.findIndex((x: { kind: string; game?: { id: string } }) => x.game?.id === 'test-game')
  await page.evaluate((i) => (window as any).__lobby.getState().focus(i, true), index)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(frame(page)).toHaveCount(1)
})

test('Escape during the flight aborts', async ({ page }) => {
  await openTestGame(page, 'noready=1&slow=99999')
  await expect(frame(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect.poll(() => phase(page), REVEAL).toBe('lobby')
  await expect(frame(page)).toHaveCount(0)
})

test('corner exit button', async ({ page }) => {
  await openTestGame(page, 'noexit=1')
  await expect(frame(page)).toHaveAttribute('data-revealed', 'true', REVEAL)
  await page.mouse.move(400, 400)
  await page.mouse.move(420, 410)
  await page.getByTestId('exit-button').click()
  await expect.poll(() => phase(page), REVEAL).toBe('lobby')
})
