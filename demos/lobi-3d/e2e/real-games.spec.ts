import { expect, test } from '@playwright/test'
import { lobby, openLobby } from './helpers'

// Runs in the "gpu" project (real GPU, see playwright.config.ts): whether a real game is revealed
// before its scene has loaded depends on load speed, and software WebGL is ~10× slower than the
// stand hardware, so judging it there would only measure SwiftShader.
test.use({ viewport: { width: 1280, height: 720 } })
const REVEAL = { timeout: 30_000 }

// real games from .games-build (skipped when none are built): the frame at the reveal moment must
// already show the whole game, not just its HUD over an empty scene. A frame with the scene still
// loading compresses to a much smaller PNG than the same game a few seconds later.
for (const id of ['crash-3d', 'plinko-3d', 'slot-3d']) {
  test(`${id} is revealed with content`, async ({ page }) => {
    await openLobby(page, '', { quality: 'high' })
    const s = await lobby(page)
    const games = s.slots.filter((x: any) => x.kind === 'game')
    const n = games.findIndex((x: any) => x.game.id === id) + 1
    test.skip(n === 0, `${id} is not built`)
    await page.evaluate((n) => (window as any).__lobby.getState().openGame(n), n)
    await expect(page.getByTestId('game-frame')).toHaveAttribute('data-revealed', 'true', REVEAL)
    await page.waitForTimeout(300) // the 250 ms fade-in
    const shot = await page.screenshot({ path: `test-results/reveal-${id}.png` })
    await page.waitForTimeout(3000)
    const later = await page.screenshot({ path: `test-results/reveal-${id}-later.png` })
    expect(shot.length).toBeGreaterThan(25_000) // an empty 1280×720 frame is under 10 KB
    expect(shot.length / later.length).toBeGreaterThan(0.75)
  })
}
