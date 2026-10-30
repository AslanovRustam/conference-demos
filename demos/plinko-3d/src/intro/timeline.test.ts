import { INTRO, assembleProgress, gemReveal, introPhase } from './timeline';

test('phases follow each other after the tap', () => {
  expect(introPhase(null).phase).toBe('crystal');
  expect(introPhase(0).phase).toBe('crack');
  expect(introPhase(INTRO.crack + 0.01).phase).toBe('explode');
  expect(introPhase(INTRO.crack + INTRO.explode + 0.01).phase).toBe('assemble');
  expect(introPhase(INTRO.crack + INTRO.explode + INTRO.assemble + 0.01).phase).toBe('gems');
  expect(introPhase(INTRO.total + 0.01).phase).toBe('done');
  const mid = introPhase(INTRO.crack / 2);
  expect(mid.p).toBeCloseTo(0.5, 2);
});

test('every shard reaches its peg by the end of assembly, top rows first', () => {
  for (const rows of [8, 12, 16]) {
    for (let row = 0; row < rows; row++) {
      expect(assembleProgress(INTRO.assemble, row, rows, 1)).toBe(1);
      expect(assembleProgress(0, row, rows, 0)).toBe(0);
    }
    const t = INTRO.assemble * 0.4;
    expect(assembleProgress(t, 0, rows, 0.5)).toBeGreaterThan(assembleProgress(t, rows - 1, rows, 0.5));
  }
});

test('gems appear from the centre outwards and are all shown at the end', () => {
  const n = 13;
  const t = INTRO.gems * 0.3;
  expect(gemReveal(t, 6, n)).toBeGreaterThan(gemReveal(t, 0, n));
  for (let k = 0; k < n; k++) {
    expect(gemReveal(0, k, n)).toBe(0);
    expect(gemReveal(INTRO.gems, k, n)).toBeCloseTo(1);
  }
});
