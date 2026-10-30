import { expect, test, type Page } from '@playwright/test'
import { lobby, openLobby } from './helpers'

test.use({ viewport: { width: 1280, height: 720 } })
const REVEAL = { timeout: 30_000 }

async function openTestGame(page: Page, query = '') {
  await openLobby(page, query)
  const s = await lobby(page)
  const n = s.slots.filter((x: any) => x.kind === 'game').findIndex((x: any) => x.game.id === 'test-game') + 1
  await page.evaluate((n) => (window as any).__lobby.getState().openGame(n), n)
}

test('moving the mouse ends attract mode', async ({ page }) => {
  await openLobby(page, '?attractIdle=2')
  await expect.poll(async () => (await lobby(page)).attract, { timeout: 15_000 }).toBe(true)
  await page.mouse.move(200, 200)
  await page.mouse.move(260, 240)
  await expect.poll(async () => (await lobby(page)).attract).toBe(false)
})

test('the game is fully faded out before it is blanked on exit', async ({ page }) => {
  await openTestGame(page)
  await expect(page.getByTestId('game-frame')).toHaveAttribute('data-revealed', 'true', REVEAL)
  await page.evaluate(() => {
    const f = document.querySelector('[data-testid=game-frame]') as HTMLIFrameElement
    new MutationObserver(() => {
      if (f.getAttribute('src') === 'about:blank') (window as any).__opacityAtBlank = getComputedStyle(f).opacity
    }).observe(f, { attributes: true, attributeFilter: ['src'] })
  })
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => (window as any).__opacityAtBlank), REVEAL).toBe('0')
})
