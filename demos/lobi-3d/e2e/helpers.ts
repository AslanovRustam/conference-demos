import { expect, type Page } from '@playwright/test'

export const lobby = (page: Page) => page.evaluate(() => (window as any).__lobby.getState())

/**
 * Behaviour tests run with ?quality=low: software WebGL in headless Chrome cannot draw the full
 * lounge (reflection, bloom, glass) fast enough, and multi-second frames stall every transition.
 * Visual checks pass { quality: 'high' }.
 */
export async function openLobby(page: Page, query = '', { quality = 'low' }: { quality?: 'low' | 'high' } = {}) {
  const q = new URLSearchParams(query.replace(/^\?/, ''))
  if (quality === 'low') q.set('quality', 'low')
  const qs = q.toString()
  await page.goto('/' + (qs ? `?${qs}` : ''))
  await expect.poll(async () => (await lobby(page)).phase).toBe('lobby')
}
