import { SHOT_IDS, type ShotId } from '../scene/camera/shotIds'

// debug cameras (scene/camera/CameraRig.tsx): close-ups on the rocket, a wide shot of the pad and the rocket, and a
// look past the rocket's nose into the sun (flare, god rays)
export const DEBUG_CAMS = ['close', 'base', 'top', 'plume', 'pad', 'sun'] as const
export type DebugCam = (typeof DEBUG_CAMS)[number]

export interface Params {
  embed: boolean
  debug: boolean
  seed: number | null
  freeze: number | null
  cam: DebugCam | null
  shot: ShotId | null // holds one broadcast camera instead of the director's cuts
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search)
  const debug = q.get('debug') === '1'
  let seed: number | null = null
  let freeze: number | null = null
  let cam: DebugCam | null = null
  let shot: ShotId | null = null
  // debug-only params are ignored without debug=1
  if (debug) {
    const s = q.get('seed')
    if (s !== null && /^-?\d+$/.test(s.trim())) seed = Number(s)
    const f = q.get('freeze')
    if (f !== null && f.trim() !== '') {
      const n = Number(f)
      if (Number.isFinite(n) && n >= 1 && n <= 1000) freeze = n
    }
    const c = q.get('cam')
    if (c !== null && (DEBUG_CAMS as readonly string[]).includes(c)) cam = c as DebugCam
    const s2 = q.get('shot')
    if (s2 !== null && (SHOT_IDS as readonly string[]).includes(s2)) shot = s2 as ShotId
  }
  return { embed: q.get('embed') === '1', debug, seed, freeze, cam, shot }
}

export const params: Params = parseParams(typeof location === 'undefined' ? '' : location.search)
