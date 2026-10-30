import { expect, type Page } from '@playwright/test'

export const lobby = (page: Page) => page.evaluate(() => (window as any).__lobby.getState())

export async function openLobby(page: Page, query = '') {
  await page.goto('/' + query)
  await expect.poll(async () => (await lobby(page)).phase).toBe('lobby')
}
