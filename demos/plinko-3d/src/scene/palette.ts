export const BG = { top: '#1b0f3d', bottom: '#06030f', halo: '#3a1d7a' } as const;

export const CRYSTAL = { light: '#c9b8ff', deep: '#6a4fd6', idleGlow: '#b9a7ff' } as const;

/** Цвет камня зависит от величины множителя (уточнение спеки, раздел 4). */
export function gemColor(multiplier: number): string {
  if (multiplier >= 100) return '#e0115f';
  if (multiplier >= 25) return '#9b30ff';
  if (multiplier >= 5) return '#2d6bff';
  if (multiplier >= 2) return '#00c2a8';
  if (multiplier >= 1) return '#7a5cff';
  return '#c7c3ff';
}

/** Радужный оттенок вспышки кристалла: зависит от позиции и медленно плывёт во времени. */
export function pegHue(flat: number, timeSec: number): number {
  const h = (flat * 0.073 + timeSec * 0.12) % 1;
  return h < 0 ? h + 1 : h;
}
