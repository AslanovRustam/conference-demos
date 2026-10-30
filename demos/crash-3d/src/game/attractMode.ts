import { attractRound } from '../core/attract'
import { IDLE_TO_ATTRACT_S } from '../core/config'
import type { RoundEngine } from '../core/round'
import { createIdleTimer } from '../platform/idle'

export const ATTRACT_GAP_S = 2

// the stand's idle loop: after IDLE_TO_ATTRACT_S in betting the game plays scripted rounds on its own; the first key
// or touch brings it back to a fresh betting screen
// held: the idle clock stands still (the stage is still loading)
export function createAttractMode(
  engine: RoundEngine,
  now: () => number = () => performance.now(),
  held: () => boolean = () => false,
) {
  let next = 0
  // entering attract resets balance, bet and auto (RoundEngine.setAttract)
  const idle = createIdleTimer(IDLE_TO_ATTRACT_S * 1000, () => engine.setAttract(true), now)
  return {
    // once per frame, after the engine tick
    tick(): void {
      const s = engine.snapshot()
      if (s.attract) {
        if (s.phase !== 'betting' || s.phaseAge < ATTRACT_GAP_S) return
        const r = attractRound(next++)
        engine.launchScripted(r.crash, r.autoAt)
        return
      }
      // the idle clock only runs while the game waits for a bet on screen
      if (s.phase !== 'betting' || held()) idle.poke()
      idle.tick()
    },
    // any key or touch; true when it only woke the game from the attract loop
    input(): boolean {
      idle.poke()
      if (!engine.snapshot().attract) return false
      engine.abortToBetting()
      engine.setAttract(false)
      return true
    },
    dispose(): void {
      idle.dispose()
    },
  }
}

export type AttractMode = ReturnType<typeof createAttractMode>
