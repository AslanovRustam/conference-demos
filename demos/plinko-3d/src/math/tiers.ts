export type Tier = 'sub' | 'normal' | 'large' | 'big' | 'mega';

export const TIER_RANK: Record<Tier, number> = { sub: 0, normal: 1, large: 2, big: 3, mega: 4 };

export function tierOf(multiplier: number): Tier {
  if (multiplier < 1) return 'sub';
  if (multiplier < 5) return 'normal';
  if (multiplier < 25) return 'large';
  if (multiplier < 100) return 'big';
  return 'mega';
}
