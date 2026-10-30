import { expect, test } from '@playwright/test'
import { lobby, openLobby } from './helpers'

test('idle lobby goes into attract and turns by itself; a key ends it', async ({ page }) => {
  await openLobby(page, '?attractIdle=2')
  await expect.poll(async () => (await lobby(page)).attract, { timeout: 15_000 }).toBe(true)
  const start = (await lobby(page)).activeIndex
  await expect.poll(async () => (await lobby(page)).activeIndex, { timeout: 15_000 }).not.toBe(start)
  await page.keyboard.press('Shift')
  expect((await lobby(page)).attract).toBe(false)
})

test('T toggles attract, F toggles the FPS meter', async ({ page }) => {
  await openLobby(page)
  await page.keyboard.press('t')
  expect((await lobby(page)).attract).toBe(true)
  await page.keyboard.press('t')
  expect((await lobby(page)).attract).toBe(false)
  await page.keyboard.press('f')
  expect((await lobby(page)).showFps).toBe(true)
  await expect(page.getByTestId('fps')).toBeVisible()
})

test('digit opens the n-th game', async ({ page }) => {
  await openLobby(page)
  await page.keyboard.press('1')
  const s = await lobby(page)
  expect(s.phase).toBe('entering')
  expect(s.slots[s.openSlot].kind).toBe('game')
})
