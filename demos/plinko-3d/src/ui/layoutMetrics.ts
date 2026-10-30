import type { Insets } from '../math/framing';

export type Orientation = 'portrait' | 'landscape';

export function orientationOf(v: { width: number; height: number }): Orientation {
  return v.height > v.width ? 'portrait' : 'landscape';
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Масштаб интерфейса: 1 до Full HD, растёт до 2 на 4K-экранах без масштабирования ОС. */
export function uiScale(v: { width: number; height: number }): number {
  return orientationOf(v) === 'portrait' ? 1 : clamp(v.height / 1080, 1, 2);
}

const NO_SAFE_AREA: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Пиксели, занятые интерфейсом по краям. Те же числа HUD кладёт в CSS-переменные. */
export function hudInsets(v: { width: number; height: number }, safe: Insets = NO_SAFE_AREA): Insets {
  if (orientationOf(v) === 'portrait') {
    return { top: 68 + safe.top, right: 8, bottom: 236 + safe.bottom, left: 8 };
  }
  const u = uiScale(v);
  return {
    top: 24 * u,
    right: clamp(0.13 * v.width, 160 * u, 280 * u) + safe.right,
    bottom: 24 * u,
    left: clamp(0.2 * v.width, 240 * u, 420 * u) + safe.left,
  };
}

let probe: HTMLDivElement | null = null;

/** Безопасные зоны экрана (вырез, полоска «домой») из CSS env(); вне браузера нули. */
export function readSafeArea(): Insets {
  if (typeof document === 'undefined') return NO_SAFE_AREA;
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}
