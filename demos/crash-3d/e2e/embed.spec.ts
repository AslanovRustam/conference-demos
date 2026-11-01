import { expect, test, type Page } from '@playwright/test'

// a lobby stand-in on the same origin (a page from elsewhere may not frame a local server): the game in an iframe,
// the host collecting what it posts
async function openInLobby(page: Page, baseURL: string | undefined) {
  await page.route('**/__lobby.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }))
  await page.goto('/__lobby.html')
  await page.evaluate((src) => {
    const w = window as unknown as { __msgs: unknown[] }
    w.__msgs = []
    window.addEventListener('message', (e) => w.__msgs.push(e.data))
    document.body.style.margin = '0'
    const f = document.createElement('iframe')
    f.src = src
    f.style.cssText = 'width:1280px;height:720px;border:0'
    document.body.replaceChildren(f)
  }, baseURL + '/?embed=1&debug=1')
  const frame = page.frameLocator('iframe')
  const game = (await (await page.locator('iframe').elementHandle())!.contentFrame())!
  return { frame, game }
}

const posted = (page: Page) =>
  page.evaluate(() => (window as unknown as { __msgs: { type?: string }[] }).__msgs.map((m) => m?.type))

test('embed hides splash, shows EXIT and posts clickable:exit', async ({ page, baseURL }) => {
  const { frame, game } = await openInLobby(page, baseURL)
  await expect(frame.locator('.splash-logo')).toHaveCount(0)
  await game.waitForFunction(() => (window as unknown as { __crashReady?: boolean }).__crashReady === true, null, { timeout: 110_000 })
  await expect(frame.locator('.hud-exit')).toBeVisible()
  await frame.locator('.hud-exit').click()
  await expect.poll(() => posted(page)).toEqual(expect.arrayContaining(['clickable:ready', 'clickable:exit']))
})

test("in the lobby the win card's EXIT leaves for the lobby", async ({ page, baseURL }) => {
  const { frame, game } = await openInLobby(page, baseURL)
  await game.waitForFunction(() => (window as unknown as { __crashReady?: boolean }).__crashReady === true, null, { timeout: 110_000 })
  type Debug = { __crash: { snap: () => { multiplier: number }; setNextCrash: (x: number) => void } }
  await game.evaluate(() => (window as unknown as Debug).__crash.setNextCrash(50))
  await frame.locator('.mb').click()
  await game.waitForFunction(() => (window as unknown as Debug).__crash.snap().multiplier >= 1.5, null, { timeout: 60_000 })
  await frame.locator('.mb').click()
  const exit = frame.locator('.wincard-btn', { hasText: 'EXIT' })
  await expect(exit).toBeVisible()
  expect(await posted(page)).not.toContain('clickable:exit')
  await exit.click()
  await expect.poll(() => posted(page)).toContain('clickable:exit')
})

test('without embed there is no EXIT and Esc posts nothing', async ({ page }) => {
  await page.goto('/?debug=1')
  await page.waitForFunction(() => (window as unknown as { __crashReady?: boolean }).__crashReady === true, null, { timeout: 110_000 })
  await expect(page.locator('.hud-exit')).toHaveCount(0)
  await page.evaluate(() => {
    const w = window as unknown as { __msgs: unknown[] }
    w.__msgs = []
    window.addEventListener('message', (e) => w.__msgs.push(e.data))
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => (window as unknown as { __msgs: unknown[] }).__msgs)).toEqual([])
})

test('while the game still loads in the lobby, EXIT is on top, Esc leaves, and a progress line shows', async ({ page, baseURL }) => {
  await page.route('**/__lobby.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }))
  await page.goto('/__lobby.html')
  await page.evaluate((src) => {
    const w = window as unknown as { __msgs: unknown[] }
    w.__msgs = []
    window.addEventListener('message', (e) => w.__msgs.push(e.data))
    const f = document.createElement('iframe')
    f.src = src
    f.style.cssText = 'width:1280px;height:720px;border:0'
    document.body.replaceChildren(f)
  }, baseURL + '/?embed=1&debug=1')
  const frame = page.frameLocator('iframe')
  await expect(frame.locator('.hud-exit')).toBeVisible()
  const game = (await (await page.locator('iframe').elementHandle())!.contentFrame())!
  await expect(frame.locator('.splash-track')).toBeVisible()
  await expect(frame.locator('.splash-logo')).toHaveCount(0)
  // still loading, nothing covers the button, and Esc goes out (checked in the page: the loading main thread is too
  // busy for playwright's click stability checks)
  const before = await game.evaluate(() => {
    const ready = (window as unknown as { __crashReady?: boolean }).__crashReady === true
    const r = document.querySelector('.hud-exit')!.getBoundingClientRect()
    const onTop = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.hud-exit') !== null
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
    return { ready, onTop }
  })
  expect(before).toEqual({ ready: false, onTop: true })
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __msgs: { type?: string }[] }).__msgs.map((m) => m?.type)))
    .toContain('clickable:exit')
})
