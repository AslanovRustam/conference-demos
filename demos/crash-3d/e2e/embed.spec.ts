import { expect, test } from '@playwright/test'

test('embed hides splash, shows EXIT and posts clickable:exit', async ({ page, baseURL }) => {
  // a lobby stand-in on the same origin (a page from elsewhere may not frame a local server): the game in an iframe,
  // the host collecting what it posts
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
  await expect(frame.locator('.splash-logo')).toHaveCount(0)
  const game = (await (await page.locator('iframe').elementHandle())!.contentFrame())!
  await game.waitForFunction(() => (window as unknown as { __crashReady?: boolean }).__crashReady === true, null, { timeout: 110_000 })
  await expect(frame.locator('.hud-exit')).toBeVisible()
  await frame.locator('.hud-exit').click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __msgs: { type?: string }[] }).__msgs.map((m) => m?.type)))
    .toEqual(expect.arrayContaining(['clickable:ready', 'clickable:exit']))
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
