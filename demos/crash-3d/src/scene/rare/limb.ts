import { Vector3 } from 'three'
import { shotFrame } from '../camera/shotFrame'
import { earthCenter } from '../far/Earth'

// the earth as the rare effects see it (far field, camera at the origin): centre and radius, the way up at the ground
// point under the camera, the shot's forward and side along the ground there, and the angle from that point to the
// limb. the effects sit near the limb in front of the shot, where a broadcast camera looking out sees them
export interface Limb {
  center: Vector3
  radius: number
  up: Vector3
  fwd: Vector3
  side: Vector3
  thetaH: number
}

export function createLimb(): Limb {
  return { center: new Vector3(), radius: 1, up: new Vector3(0, 1, 0), fwd: new Vector3(0, 0, -1), side: new Vector3(1, 0, 0), thetaH: 0.1 }
}

export function updateLimb(l: Limb, stageF: number, altM: number): void {
  l.radius = earthCenter(stageF, altM, l.center)
  l.up.copy(l.center).normalize().negate()
  const f = shotFrame.forward
  l.fwd.copy(f).addScaledVector(l.up, -f.dot(l.up))
  if (l.fwd.lengthSq() < 1e-8) l.fwd.set(1, 0, 0).addScaledVector(l.up, -l.up.x)
  l.fwd.normalize()
  l.side.crossVectors(l.up, l.fwd)
  l.thetaH = Math.acos(Math.min(1, l.radius / l.center.length()))
}

// the glsl side: a point on the earth's sphere at angle theta from the ground point, towards azimuth phi off the shot
export const LIMB_GLSL = /* glsl */ `
uniform vec3 uC;
uniform float uR;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform vec3 uSide;
uniform float uThetaH;
vec3 limbNormal(float theta, float phi) {
  vec3 t = uFwd * cos(phi) + uSide * sin(phi);
  return uUp * cos(theta) + t * sin(theta);
}
`

export function limbUniforms(l: Limb) {
  return {
    uC: { value: l.center },
    uR: { value: l.radius },
    uUp: { value: l.up },
    uFwd: { value: l.fwd },
    uSide: { value: l.side },
    uThetaH: { value: l.thetaH },
  }
}

// scalars do not travel by reference: copy them into the uniforms each frame
export function syncLimb(u: ReturnType<typeof limbUniforms>, l: Limb): void {
  u.uR.value = l.radius
  u.uThetaH.value = l.thetaH
}

// where a ray from the camera (the far field's origin) along dir meets the earth's sphere scaled by k: the unit
// normal there, or null when it passes the earth
export function hitEarth(l: Limb, dir: Vector3, k: number, out: Vector3): Vector3 | null {
  const b = dir.dot(l.center)
  const r = l.radius * k
  const disc = b * b - (l.center.lengthSq() - r * r)
  if (disc < 0) return null
  const t = b - Math.sqrt(disc)
  if (t <= 0) return null
  return out.copy(dir).multiplyScalar(t).sub(l.center).normalize()
}
