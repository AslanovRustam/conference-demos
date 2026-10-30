import type { ShotId } from './shotIds'

// a rare event asks the director for a camera (scene/rare): it cuts there as soon as it may and holds it
export const shotRequest: { shot: ShotId | null; hold: number } = { shot: null, hold: 0 }

export function requestShot(shot: ShotId, hold: number): void {
  shotRequest.shot = shot
  shotRequest.hold = hold
}

// the event is over: a request the director never got to (a crash came first) must not leak into the next round
export function cancelShotRequest(): void {
  shotRequest.shot = null
}
