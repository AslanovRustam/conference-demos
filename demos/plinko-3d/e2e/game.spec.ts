import { expect, test, type Page } from '@playwright/test';

// Заставка реагирует только когда всё загружено: ждём надпись и жмём на неё
async function start(page: Page, mobile = false) {
  await page.goto('/?seed=1');
  const tap = page.getByText('TAP TO PLAY');
  await expect(tap).toBeVisible({ timeout: 30_000 });
  if (mobile) await tap.tap();
  else await tap.click();
  await expect(page.getByTestId('splash')).toHaveCount(0);
}

const balanceOf = async (page: Page) => Number((await page.getByTestId('balance').innerText()).replace(/,/g, ''));

test('boots without errors and drops', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await start(page, isMobile);
  await page.getByTestId('drop').click();
  await expect(page.getByTestId('history').locator('> *')).toHaveCount(1, { timeout: 25_000 });
  await expect.poll(() => balanceOf(page)).not.toBe(10000);
  expect(errors).toEqual([]);
});

test('settings locked while ball in flight', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.getByTestId('drop').click();
  await expect(page.getByTestId('risk-low')).toBeDisabled();
  await expect(page.getByTestId('rows-plus')).toBeDisabled();
  await expect(page.getByTestId('bet-plus')).toBeEnabled();
});

test('touch spam does not zoom and never goes negative', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await start(page, true);
  const box = (await page.getByTestId('drop').boundingBox())!;
  for (let i = 0; i < 25; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => balanceOf(page)).toBeLessThan(10000);
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  expect(await balanceOf(page)).toBeGreaterThanOrEqual(0);
});

test('presenter big win shows overlay', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await start(page);
  await page.keyboard.press('Shift+KeyB');
  await page.getByTestId('drop').click();
  await expect(page.getByTestId('celebrate-overlay')).toBeVisible({ timeout: 40_000 });
  await page.getByTestId('celebrate-overlay').click(); // тап пропускает счётчик
  await expect(page.getByTestId('celebrate-overlay')).toHaveCount(0, { timeout: 10_000 });
});

test('resize keeps game alive', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('drop').click();
  await expect(page.getByTestId('history').locator('> *')).toHaveCount(1, { timeout: 25_000 });
});
