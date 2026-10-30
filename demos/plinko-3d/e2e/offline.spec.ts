import { expect, test } from '@playwright/test';

test('loads offline after first visit', async ({ page, context }) => {
  await page.goto('/?seed=1');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // теперь страницей управляет service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('900 20px Clickable'))).toBe(true);
});

test('manifest is installable', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest.name).toBe('Clickable Plinko');
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
});
