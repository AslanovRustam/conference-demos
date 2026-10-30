import { BALL_RADIUS, PEG_RADIUS, SLOT_GEM_BOTTOM, SLOT_LABEL_HALF, SLOT_LABEL_Y, SPACING, boardLayout, pegCount, pegFlatIndex } from './layout';

test('peg counts and flat index', () => {
  expect(pegCount(16)).toBe(168);
  expect(pegCount(8)).toBe(52);
  expect(pegFlatIndex(1, 0)).toBe(3);
  expect(pegFlatIndex(2, 0)).toBe(7);
  const L = boardLayout(12);
  expect(L.pegs).toHaveLength(pegCount(12));
  expect(L.slots).toHaveLength(13);
  L.pegs.forEach((p) => expect(p.flat).toBe(pegFlatIndex(p.row, p.index)));
});

test('ball fits between pegs', () => {
  expect(SPACING - 2 * PEG_RADIUS).toBeGreaterThan(2 * BALL_RADIUS * 1.5);
});

test('slots sit between last-row pegs', () => {
  const L = boardLayout(10);
  const last = L.pegs.filter((p) => p.row === 9);
  L.slots.forEach((s, k) => expect(s.x).toBeCloseTo((last[k].x + last[k + 1].x) / 2, 9));
});

test('bounds cover pegs, slots and spawn', () => {
  const L = boardLayout(16);
  for (const p of [...L.pegs, ...L.slots, L.spawn]) {
    expect(p.x).toBeGreaterThanOrEqual(L.bounds.minX);
    expect(p.x).toBeLessThanOrEqual(L.bounds.maxX);
    expect(p.y).toBeGreaterThanOrEqual(L.bounds.minY);
    expect(p.y).toBeLessThanOrEqual(L.bounds.maxY);
  }
});

// Подписи множителей наезжали на камни-ячейки: подпись стоит целиком под камнем и входит в кадр доски
test('multiplier labels sit below the slot gems and inside the framed bounds', () => {
  expect(SLOT_LABEL_Y + SLOT_LABEL_HALF).toBeLessThanOrEqual(SLOT_GEM_BOTTOM);
  const L = boardLayout(16);
  expect(L.slots[0].y + SLOT_LABEL_Y - SLOT_LABEL_HALF).toBeGreaterThanOrEqual(L.bounds.minY);
});
