export const PENTATONIC_ROOT_HZ = 220; // A3

const SEMITONES = [0, 2, 4, 7, 9]; // мажорная пентатоника: любая последовательность звучит музыкально

/** Нота ряда: ряд 0 самый низкий, дальше вверх по пентатонике. */
export function rowFrequency(row: number): number {
  const semi = SEMITONES[row % 5] + 12 * Math.floor(row / 5);
  return PENTATONIC_ROOT_HZ * 2 ** (semi / 12);
}

/** Ограничение одновременных голосов: при переполнении отнимается самый старый. */
export class VoicePool {
  private readonly started: number[];

  constructor(capacity: number) {
    this.started = new Array(capacity).fill(-1);
  }

  acquire(now: number): { index: number; stolen: boolean } {
    const free = this.started.indexOf(-1);
    if (free !== -1) {
      this.started[free] = now;
      return { index: free, stolen: false };
    }
    let oldest = 0;
    for (let i = 1; i < this.started.length; i++) if (this.started[i] < this.started[oldest]) oldest = i;
    this.started[oldest] = now;
    return { index: oldest, stolen: true };
  }

  release(index: number): void {
    this.started[index] = -1;
  }
}
