import { expect, test } from '@playwright/test'
import { lobby, openLobby } from './helpers'

// a phone held upright: the visitor must see there is more than one game and how to browse
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('a touch screen says there are more games, with one dot per cabinet', async ({ page }) => {
  await openLobby(page)
  await expect(page.getByTestId('swipe-hint')).toBeVisible()
  const s = await lobby(page)
  const dots = page.getByTestId('dots').getByRole('button')
  await expect(dots).toHaveCount(s.slots.length)
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true')
})

test('tapping a dot brings that cabinet to the front and retires the hint', async ({ page }) => {
  await openLobby(page)
  await page.getByTestId('dots').getByRole('button').nth(2).tap()
  expect((await lobby(page)).activeIndex).toBe(2)
  await expect(page.getByTestId('dots').getByRole('button').nth(2)).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('swipe-hint')).toHaveCount(0)
})

test('the carousel leans toward the next cabinet by itself and settles back', async ({ page }) => {
  await openLobby(page)
  await expect.poll(async () => (await lobby(page)).carouselTarget, { timeout: 6000, intervals: [50] }).toBeGreaterThan(0.1)
  await expect.poll(async () => (await lobby(page)).carouselTarget, { timeout: 6000 }).toBe(0)
  expect((await lobby(page)).activeIndex).toBe(0)
})

test('a touch during the lean puts the carousel straight back on its cabinet', async ({ page }) => {
  await openLobby(page)
  await expect.poll(async () => (await lobby(page)).carouselTarget, { timeout: 6000, intervals: [50] }).toBeGreaterThan(0.05)
  // any touch counts; the sound button is one that cannot turn the carousel itself
  await page.getByTestId('mute').tap()
  expect((await lobby(page)).carouselTarget).toBe(0)
})

test('PLAY and the pager share the bottom row inside the screen', async ({ page }) => {
  await openLobby(page)
  const play = (await page.getByTestId('play').boundingBox())!
  const next = (await page.getByTestId('next').boundingBox())!
  expect(Math.abs(play.y + play.height / 2 - (next.y + next.height / 2))).toBeLessThan(6)
  expect(next.x + next.width).toBeLessThanOrEqual(390)
  expect(play.x + play.width).toBeLessThan((await page.getByTestId('prev').boundingBox())!.x)
})
