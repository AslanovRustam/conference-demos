import { smoothstep } from '../env/atmosphere'
import { GROUND_Y } from '../pad/layout'

// art direction of the sky over the flight, by stage (rig.stageF)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// how high the camera is over the ground (the near field sinks by nearOffset past the floating origin cap)
export function cameraAltitudeM(cameraY: number, nearOffset: number): number {
  return Math.max(0, cameraY - GROUND_Y + nearOffset)
}

// the broadcast camera's exposure for the sky: a 1 is the sun's own scattering scale. the night pad needs a long
// exposure for the twilight to glow; the dawn over the clouds is ten times brighter, so it comes down, and keeps
// coming down through the stratosphere so the sky goes dark while the sun climbs. log-linear between [stageF, exposure]
const EXPOSURE: [number, number][] = [
  [1, 400],
  [1.6, 160],
  [1.95, 22],
  [2.1, 10],
  [2.3, 5],
  [2.5, 2.5],
  [2.9, 1.5],
]
export function skyExposureAt(stageF: number): number {
  const k = EXPOSURE
  if (stageF <= k[0][0]) return k[0][1]
  for (let i = 1; i < k.length; i++) {
    if (stageF <= k[i][0]) {
      const t = (stageF - k[i - 1][0]) / (k[i][0] - k[i - 1][0])
      return Math.exp(lerp(Math.log(k[i - 1][1]), Math.log(k[i][1]), t))
    }
  }
  return k[k.length - 1][1]
}

// moonlight scatters 1/1000 as strongly as the sun's in the dome (the moonlit night sky deep blue); once the sun is
// up it is lost in the daylight, and the dome stops integrating it
export const MOON_SKY = 1e-3
export function moonSkyAt(stageF: number): number {
  return MOON_SKY * (1 - smoothstep(1.85, 2.1, stageF))
}

// the dome fades to black space as the air thins; the earth's limb (task 16) carries the horizon glow from there
export function skyFadeAt(stageF: number): number {
  return 1 - smoothstep(2.3, 2.9, stageF)
}

// faintest star magnitude drawn: the brightest few through the pad's twilight, the whole field from the stratosphere
export const STAR_LIMIT_PAD = 2.8
export const STAR_LIMIT_SPACE = 8
export function starLimitAt(stageF: number): number {
  return lerp(STAR_LIMIT_PAD, STAR_LIMIT_SPACE, smoothstep(1.5, 2.5, stageF))
}

// the milky way needs a dark sky
export function milkyWayAt(stageF: number): number {
  return smoothstep(1.7, 2.6, stageF)
}

// 1 at the ground, ~0 above the stratosphere: how much air the starlight crosses (extinction, twinkle)
export function airAt(altM: number): number {
  return Math.exp(-Math.max(0, altM) / 8000)
}
