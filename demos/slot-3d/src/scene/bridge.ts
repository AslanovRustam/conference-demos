import type { GridView } from './GridView'

/** imperative scene controls the director drives; filled in by the scene components on mount */
export interface StageApi {
  shake(strength: number, duration: number): void
  /** bloom + chromatic aberration pulse */
  flash(strength: number, duration?: number): void
  /** slow camera push-in while the last reels decide */
  anticipation(on: boolean): void
  /** unlock and swing the vault door open, moving the camera to the reels */
  openVault(): Promise<void>
  /** swing the door shut and lock it, pulling the camera back to the door */
  closeVault(): Promise<void>
  enterBonus(): Promise<void>
  exitBonus(): Promise<void>
  /** coin fountain rate in coins per second, 0 stops it */
  coins(rate: number): void
  coinBurst(count: number): void
  /** coins pouring down over the whole screen, per second; 0 stops */
  coinRain(rate: number): void
  multiplierHit(): void
  /** quick camera jab towards the machine */
  punch(strength: number): void
  /** slow camera orbit for attract mode */
  orbit(on: boolean): void
}

export const bridge: { grid: GridView | null; stage: StageApi | null } = { grid: null, stage: null }
