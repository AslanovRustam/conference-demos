import type { Emitter } from '../core/events'
import type { StageId } from '../core/stages'
import type { SafeStorage } from '../platform/storage'

// what the game asks the sound to play; audio/sfx.ts makes the noise
export interface SfxApi {
  countdown(n: number): void
  liftoff(): void
  stage(s: StageId): void
  cashout(): void
  parachute(): void
  crash(stage: StageId, far: boolean): void
  win(payout: number): void
  ui(): void
}

// game events → sounds. a cash out in the air (stages 0–1) opens a parachute; after it the rocket flies on out of
// frame, its stages pass without a sound
export function bindAudio(emitter: Emitter, sfx: SfxApi): () => void {
  let cashedOut = false
  return emitter.on((e) => {
    switch (e.type) {
      case 'launch':
      case 'betting':
        cashedOut = false
        break
      case 'countdown':
        sfx.countdown(e.n)
        break
      case 'liftoff':
        sfx.liftoff()
        break
      case 'stage':
        if (!cashedOut) sfx.stage(e.stage)
        break
      case 'cashout':
        cashedOut = true
        sfx.cashout()
        if (e.stage <= 1) sfx.parachute()
        sfx.win(e.payout)
        break
      case 'crash':
        sfx.crash(e.stage, e.cashedOut)
        break
    }
  })
}

// a hidden tab (or a locked phone) suspends the audio; coming back resumes it unless the player muted it
export function bindVisibility(
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  ctx: Pick<AudioContext, 'suspend' | 'resume'>,
  isMuted: () => boolean,
): () => void {
  const onChange = () => {
    if (doc.hidden) void ctx.suspend().catch(() => {})
    else if (!isMuted()) void ctx.resume().catch(() => {})
  }
  doc.addEventListener('visibilitychange', onChange)
  return () => doc.removeEventListener('visibilitychange', onChange)
}

const MUTED_KEY = 'muted'

export function loadMuted(storage: SafeStorage): boolean {
  return storage.get(MUTED_KEY) === '1'
}

export function saveMuted(storage: SafeStorage, muted: boolean): void {
  storage.set(MUTED_KEY, muted ? '1' : '0')
}
