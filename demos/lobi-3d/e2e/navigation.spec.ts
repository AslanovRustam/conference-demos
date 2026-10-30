import { expect, test } from '@playwright/test'
import { lobby, openLobby } from './helpers'

test('arrow keys turn the carousel', async ({ page }) => {
  await openLobby(page)
  await page.keyboard.press('ArrowRight')
  expect((await lobby(page)).activeIndex).toBe(1)
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  const s = await lobby(page)
  expect(s.activeIndex).toBe(s.slots.length - 1)
})

test('Enter on a COMING SOON cabinet stays in the lobby', async ({ page }) => {
  await openLobby(page)
  const s = await lobby(page)
  const soon = s.slots.findIndex((slot: { kind: string }) => slot.kind === 'soon')
  await page.evaluate((i) => (window as any).__lobby.getState().focus(i, true), soon)
  await page.keyboard.press('Enter')
  const after = await lobby(page)
  expect(after.phase).toBe('lobby')
  expect(after.deniedToken).toBe(1)
})

test('a slow drag to the left moves one cabinet', async ({ page }) => {
  await openLobby(page)
  const { width, height } = page.viewportSize()!
  await page.mouse.move(width * 0.7, height * 0.85)
  await page.mouse.down()
  await page.mouse.move(width * 0.3, height * 0.85, { steps: 20 })
  await page.waitForTimeout(200)
  await page.mouse.up()
  expect((await lobby(page)).activeIndex).toBe(1)
})

test('a click without movement does not turn the carousel', async ({ page }) => {
  await openLobby(page)
  const { width, height } = page.viewportSize()!
  await page.mouse.click(width * 0.5, height * 0.08)
  expect((await lobby(page)).activeIndex).toBe(0)
})

test('clicking a side cabinet brings it to the front', async ({ page }) => {
  await openLobby(page)
  const { width, height } = page.viewportSize()!
  await page.waitForTimeout(500)
  await page.mouse.click(width * 0.86, height * 0.55)
  expect((await lobby(page)).activeIndex).toBe(1)
})
