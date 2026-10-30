import { expect, test } from '@playwright/test'
import { lobby, openLobby } from './helpers'

const sfx = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__sfx.snapshot())

test('sounds follow lobby events and the mute key', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await openLobby(page)
  expect((await sfx(page)).context).toBe('none') // nothing before the first gesture
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await sfx(page)).plays.tick ?? 0).toBeGreaterThanOrEqual(1)
  expect((await sfx(page)).context).toBe('running')

  const s = await lobby(page)
  const soon = s.slots.findIndex((x: { kind: string }) => x.kind === 'soon')
  await page.evaluate((i) => (window as any).__lobby.getState().focus(i, true), soon)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await sfx(page)).plays.denied ?? 0).toBe(1)

  await page.keyboard.press('m')
  await expect.poll(async () => (await sfx(page)).muted).toBe(true)
  expect(errors).toEqual([])
})
