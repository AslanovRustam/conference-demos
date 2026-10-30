import { expect, test, type Page } from '@playwright/test';

type SimWindow = Window & { __sim: { store: { getState(): { setQuality(q: 'high' | 'light'): void } } } };

// Самая яркая точка в полосе по центру экрана (левая половина камня, мимо логотипа) за ~0,7 с.
// Грани бриллианта дают почти белые блики, а фон, лучи и боке остаются тёмно-фиолетовыми.
async function gemHighlight(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const w = Math.floor(H * 0.16);
    const h = Math.floor(H * 0.1);
    const x = Math.floor(W / 2 - H * 0.24);
    const y = Math.floor(H / 2 - h / 2);
    const px = new Uint8Array(4 * w * h);
    let best = 0;
    for (let frame = 0; frame < 40; frame++) {
      await new Promise((r) => requestAnimationFrame(r));
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i = 0; i < px.length; i += 4) best = Math.max(best, Math.min(px[i], px[i + 1], px[i + 2]));
    }
    return best;
  });
}

// Пользователь видел, как камень исчезал через пару секунд: PerformanceMonitor снижал качество high → light,
// материал камня пересоздавался без BVH огранки и переставал рисоваться.
test('intro gem survives the automatic quality downgrade', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.goto('/?quality=high&debug=1');
  await expect(page.getByText('TAP TO PLAY')).toBeVisible({ timeout: 30_000 });
  expect(await gemHighlight(page)).toBeGreaterThan(200);

  await page.evaluate(() => (window as unknown as SimWindow).__sim.store.getState().setQuality('light'));
  await page.waitForTimeout(500);
  expect(await gemHighlight(page)).toBeGreaterThan(200);
});
