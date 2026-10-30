/** Яркость свечения каждого кристалла, 0…1. */
export class GlowField {
  readonly values: Float32Array;

  constructor(capacity: number) {
    this.values = new Float32Array(capacity);
  }

  hit(flat: number, amount = 1): void {
    if (amount > this.values[flat]) this.values[flat] = amount;
  }

  decay(dt: number, rate = 2.2): void {
    const step = dt * rate;
    for (let i = 0; i < this.values.length; i++) this.values[i] = Math.max(0, this.values[i] - step);
  }

  clear(): void {
    this.values.fill(0);
  }
}
