import type { StageId } from './stages'

export type GameEvent =
  | { type: 'launch'; bet: number }
  | { type: 'countdown'; n: 3 | 2 | 1 }
  | { type: 'liftoff' }
  | { type: 'stage'; stage: StageId }
  | { type: 'cashout'; multiplier: number; payout: number; stage: StageId; auto: boolean }
  | { type: 'crash'; multiplier: number; cashedOut: boolean; stage: StageId }
  | { type: 'result'; won: boolean; payout: number }
  | { type: 'betting' }
  | { type: 'refuel'; balance: number }

export class Emitter {
  private fns: Array<(e: GameEvent) => void> = []

  on(fn: (e: GameEvent) => void): () => void {
    this.fns.push(fn)
    return () => {
      this.fns = this.fns.filter((f) => f !== fn)
    }
  }

  emit(e: GameEvent): void {
    for (const fn of [...this.fns]) fn(e)
  }
}
