import { ALT_ANCHORS_KM, VEL_ANCHORS_KMS } from './config'
import { stageFloat } from './stages'

function lerpAnchors(anchors: number[], f: number): number {
  const i = Math.min(Math.floor(f), anchors.length - 2)
  return anchors[i] + (anchors[i + 1] - anchors[i]) * (f - i)
}

// a heavy liftoff: through stage 0 the climb eases in (f^4), so the rocket crawls past the tower first and
// reaches stage 1's climb rate right at the border
const LIFTOFF_EASE = 4

export function telemetry(m: number): { altKm: number; velKmS: number } {
  const f = Math.min(stageFloat(m), 6)
  const altKm = f < 1 ? ALT_ANCHORS_KM[1] * f ** LIFTOFF_EASE : lerpAnchors(ALT_ANCHORS_KM, f)
  return { altKm, velKmS: lerpAnchors(VEL_ANCHORS_KMS, f) }
}
