import { expect, test } from '@playwright/test';

// Пользователь видел мигание экрана при каждом отскоке: это целиком чёрные кадры.
// Считаем кадры, где и угол экрана, и середина пирамиды читаются абсолютно чёрными (фон никогда не чёрный).
test('no black frames while balls bounce (high quality)', async ({ page, isMobile }) => {
  test.skip(isMobile);
  test.setTimeout(90_000);
  await page.goto('/?seed=21&quality=high');
  await page.getByText('TAP TO PLAY').click({ timeout: 30_000 });
  const black = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 1500));
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const px = new Uint8Array(4 * 40 * 40);
    const sum = (x: number, y: number) => {
      gl.readPixels(x, y, 40, 40, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let s = 0;
      for (let i = 0; i < px.length; i += 4) s += px[i] + px[i + 1] + px[i + 2];
      return s;
    };
    const drop = document.querySelector('[data-testid=drop]') as HTMLButtonElement;
    const found: number[] = [];
    const t0 = performance.now();
    drop.click();
    setTimeout(() => drop.click(), 1500);
    setTimeout(() => drop.click(), 3000);
    await new Promise<void>((resolve) => {
      const loop = () => {
        const t = performance.now() - t0;
        if (sum(W - 60, H - 60) === 0 && sum(Math.floor(W * 0.6), Math.floor(H * 0.5)) === 0) found.push(Math.round(t));
        if (t < 9000) requestAnimationFrame(loop);
        else resolve();
      };
      requestAnimationFrame(loop);
    });
    return found;
  });
  expect(black).toEqual([]);
});
