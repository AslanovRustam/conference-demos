import { AddEquation, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, ZeroFactor, type Material } from 'three'

// the current explosion, shared by its parts: where it happened (absolute altitude, like the free capsule),
// when (rig.vtime), whether the player had cashed out (a shorter show) and whether it went off in the air
export interface Blast {
  active: boolean
  x: number
  alt: number
  z: number
  vtime0: number
  short: boolean
  inAir: boolean
}

export function createBlast(): Blast {
  return { active: false, x: 0, alt: 0, z: 0, vtime0: 0, short: false, inAir: true }
}

// premultiplied "over" blending that leaves the target alpha alone (the clouds pass reads it)
export function premultipliedOver(m: Material): void {
  m.transparent = true
  m.depthWrite = false
  m.blending = CustomBlending
  m.blendEquation = AddEquation
  m.blendSrc = OneFactor
  m.blendDst = OneMinusSrcAlphaFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
}

// pure light added on top, target alpha untouched
export function additiveLight(m: Material): void {
  m.transparent = true
  m.depthWrite = false
  m.blending = CustomBlending
  m.blendEquation = AddEquation
  m.blendSrc = OneFactor
  m.blendDst = OneFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
}

// a compact 3d value noise for the blast shaders
export const NOISE_GLSL = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`
