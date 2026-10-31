import type { Page } from '@playwright/test'
import type { RoundSnapshot } from '../src/core/types'

declare global {
  interface Window {
    __crash: { snap: () => RoundSnapshot; setNextCrash: (x: number) => void }
    __crashReady?: boolean
  }
}

// the scene is loaded, compiled and drawing (debug only)
export async function open(page: Page, query = '?debug=1&seed=1'): Promise<void> {
  await page.goto('/' + query)
  await page.waitForFunction(() => window.__crashReady === true, null, { timeout: 110_000 })
}

export const snap = (page: Page) => page.evaluate(() => window.__crash.snap())

export async function nextCrash(page: Page, x: number): Promise<void> {
  await page.evaluate((v) => window.__crash.setNextCrash(v), x)
}

export async function waitPhase(page: Page, ...phases: string[]): Promise<void> {
  await page.waitForFunction((ps) => ps.includes(window.__crash.snap().phase), phases, { timeout: 60_000 })
}
