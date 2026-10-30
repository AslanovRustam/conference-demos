import { Color, Vector2 } from 'three'

// a screen-space heat haze or shockwave ring
export interface DistortionSource {
  pos: Vector2 // uv
  radius: number
  strength: number
  ring: boolean
}

// screen effects shared by the scene: the plume, explosion, camera director, warp and sun write here,
// the post chain reads it every frame
export const fx = {
  chroma: 0, // 0..1 chromatic aberration burst
  flash: 0, // 0..1 full-screen flash towards flashColor
  flashColor: new Color(),
  dofPulse: 0, // 0..1 focus pull on camera cuts
  shake: 0, // camera shake amplitude
  zoomBlur: 0, // radial blur length as a fraction of the distance to the screen center
  distortion: [] as DistortionSource[],
  sunScreen: new Vector2(), // sun position in uv
  sunVisible: 0, // 0..1
}
