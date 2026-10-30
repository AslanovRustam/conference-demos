import { ALT_ANCHORS_KM, VEL_ANCHORS_KMS } from './config'
import { stageFloat } from './stages'

function lerpAnchors(anchors: number[], f: number): number {
  const i = Math.min(Math.floor(f), anchors.length - 2)
  return anchors[i] + (anchors[i + 1] - anchors[i]) * (f - i)
}

export function telemetry(m: number): { altKm: number; velKmS: number } {
  const f = Math.min(stageFloat(m), 6)
  return { altKm: lerpAnchors(ALT_ANCHORS_KM, f), velKmS: lerpAnchors(VEL_ANCHORS_KMS, f) }
}
