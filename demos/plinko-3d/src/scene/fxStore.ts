import * as THREE from 'three';
import { GlowField } from '../fx/glowField';
import { pegCount } from '../math/layout';

/** Свечение кристаллов: его наполняют касания, волны и празднования, читает Pegs. */
export const pegGlow = new GlowField(pegCount(16));

const MAX_SLOTS = 17;

/** Состояние камней-ячеек на текущий кадр: пишет Slots, читают эффекты вокруг камней (SlotFx). */
export const slotView = {
  count: 0,
  x: new Float32Array(MAX_SLOTS),
  y: new Float32Array(MAX_SLOTS),
  /** итоговый масштаб камня (появление, вспышка, предвкушение); 0 — камня не видно */
  scale: new Float32Array(MAX_SLOTS),
  /** «дыхание» света, 0…1 */
  light: new Float32Array(MAX_SLOTS),
  /** предвкушение шарика, 0…1 */
  antic: new Float32Array(MAX_SLOTS),
  /** 1 для ячеек BIG и MEGA (над ними искры и столб света) */
  big: new Uint8Array(MAX_SLOTS),
  colors: Array.from({ length: MAX_SLOTS }, () => new THREE.Color()),
};

/** Точки входа в эффекты сцены. Компоненты регистрируют их при монтировании. */
export const fxHooks: {
  burst?(x: number, y: number, count: number, power: number): void;
  flashSlot?(slot: number, amount: number): void;
  floatText?(slot: number, text: string, dim: boolean): void;
  shake?(amp: number, sec: number): void;
  pulse?(bloom: number, ca: number, sec: number): void;
  wave?(x: number, y: number, intensity: number): void;
} = {};
