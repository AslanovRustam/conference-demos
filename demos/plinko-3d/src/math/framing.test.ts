import { hudInsets, orientationOf } from '../ui/layoutMetrics';
import { computeFraming, type Framing } from './framing';
import { boardLayout } from './layout';

// Перспективная проекция камеры, смотрящей прямо на плоскость z = 0
function project(x: number, y: number, f: Framing, v: { width: number; height: number }, fovDeg: number) {
  const pxPerUnit = v.height / (2 * f.z * Math.tan((fovDeg * Math.PI) / 360));
  return { x: v.width / 2 + (x - f.targetX) * pxPerUnit, y: v.height / 2 - (y - f.targetY) * pxPerUnit };
}

const L = boardLayout(16);

test.each([
  { v: { width: 390, height: 844 } }, // телефон, портрет
  { v: { width: 844, height: 390 } }, // телефон, ландшафт
  { v: { width: 1920, height: 1080 } }, // ноутбук
])('board fits free area $v.width x $v.height', ({ v }) => {
  const ins = hudInsets(v);
  const f = computeFraming(L.bounds, v, ins, 35);
  const corners = [
    [L.bounds.minX, L.bounds.minY],
    [L.bounds.maxX, L.bounds.maxY],
    [L.bounds.minX, L.bounds.maxY],
    [L.bounds.maxX, L.bounds.minY],
  ];
  const px = corners.map(([x, y]) => project(x, y, f, v, 35));
  px.forEach((p) => {
    expect(p.x).toBeGreaterThanOrEqual(ins.left - 1);
    expect(p.x).toBeLessThanOrEqual(v.width - ins.right + 1);
    expect(p.y).toBeGreaterThanOrEqual(ins.top - 1);
    expect(p.y).toBeLessThanOrEqual(v.height - ins.bottom + 1);
  });
  const freeW = v.width - ins.left - ins.right;
  const freeH = v.height - ins.top - ins.bottom;
  const w = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
  const h = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
  expect(Math.max(w / freeW, h / freeH)).toBeGreaterThan(0.8); // пирамида не мелкая
});

test('orientation', () => {
  expect(orientationOf({ width: 390, height: 844 })).toBe('portrait');
  expect(orientationOf({ width: 1920, height: 1080 })).toBe('landscape');
});

test('camera looks straight at its target', () => {
  const f = computeFraming(L.bounds, { width: 1920, height: 1080 }, hudInsets({ width: 1920, height: 1080 }), 35);
  expect(f.x).toBe(f.targetX);
  expect(f.y).toBe(f.targetY);
  expect(f.z).toBeGreaterThan(0);
});
