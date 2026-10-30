import { GlowField } from '../fx/glowField';
import { pegCount } from '../math/layout';

/** Свечение кристаллов: его наполняют касания, волны и празднования, читает Pegs. */
export const pegGlow = new GlowField(pegCount(16));

/** Точки входа в эффекты сцены. Компоненты регистрируют их при монтировании. */
export const fxHooks: {
  burst?(x: number, y: number, count: number, power: number): void;
  flashSlot?(slot: number, amount: number): void;
  floatText?(slot: number, text: string, dim: boolean): void;
  shake?(amp: number, sec: number): void;
  pulse?(bloom: number, ca: number, sec: number): void;
  wave?(x: number, y: number, intensity: number): void;
} = {};
