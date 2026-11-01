import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { AdditiveBlending, Color, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3, type Camera } from 'three'
import { horizonDip, smoothstep, sunTransmittance } from '../env/atmosphere'
import { lightState, overrideSunElevation, sunAbove } from '../env/lightState'
import { fx } from '../fx'
import { registerPrewarm } from '../prewarm'
import { rig } from '../rig'
import { FAR_SKY_R } from './FarField'
import { cameraAltitudeM } from './skyCurves'

// the sun: a hot limb-darkened disc with a soft corona in the far field, reddened and cut by the horizon; it tells the
// post chain where it is (fx.sunScreen) and how much of it shows (fx.sunVisible: 0 below the horizon, behind the
// earth or off screen). the god rays (post/SunRaysEffect.ts) take their light from a twin of the disc that lives
// outside the scene (sunRaysSource): it depth-tests against the scene, so the rocket cuts the rays

// the sunrise event (task 19) drives the sun's elevation, radians over the horizontal; null returns it to the flight
export function setSunElevation(rad: number | null): void {
  overrideSunElevation(rad)
}

const SUN_DIST = FAR_SKY_R * 0.9
const DISC_DEG = 0.42 // apparent radius: a little larger than the real 0.27 for the broadcast frame
const QUAD = 6 // quad half-size in disc radii (corona)
const DISC_I = 40 // hdr disc brightness in space
const RAYS_I = 2.5 // the god ray source is dimmer: the ray pass clamps anyway
const EDGE = 0.15 // fx.sunVisible fades out this far (in screen widths) past the frame

const vertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vDir;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vDir = w.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const fragment = /* glsl */ `
uniform vec3 uColor;
uniform float uHorizon;
uniform float uIntensity;
uniform float uCorona;
varying vec2 vUv;
varying vec3 vDir;
void main() {
  float r = length(vUv * 2.0 - 1.0) * ${QUAD.toFixed(1)}; // in disc radii
  float disc = 1.0 - smoothstep(0.94, 1.0, r);
  float limb = 0.55 + 0.45 * sqrt(max(0.0, 1.0 - r * r));
  float corona = uCorona * (exp(-(r - 1.0) * 1.6) * 0.05 + 0.012 / (r * r)) * (1.0 - smoothstep(${(QUAD * 0.7).toFixed(1)}, ${QUAD.toFixed(1)}, r));
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float above = smoothstep(uHorizon - 0.0004, uHorizon + 0.0004, el);
  vec3 c = uColor * uIntensity * (disc * limb + corona * (1.0 - disc)) * above;
  gl_FragColor = vec4(c, 1.0);
}
`

function sunMaterial(uniforms: Record<string, { value: unknown }>, rays: boolean): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    // in the scene: the opaque list, so it draws by renderOrder before the near field (the blending still adds);
    // transparent objects would draw after the rocket, and with depthTest off, over it
    transparent: rays,
    blending: rays ? NormalBlending : AdditiveBlending,
    depthTest: rays,
    depthWrite: false,
  })
}

const discRadius = SUN_DIST * Math.tan((DISC_DEG * Math.PI) / 180)
const shared = {
  uColor: { value: new Color() },
  uHorizon: { value: 0 },
}
let raysSource: Mesh | null = null

// the god rays' light source: not in the scene, placed by <Sun /> every frame (matrices updated by hand)
export function sunRaysSource(): Mesh {
  if (!raysSource) {
    const m = new Mesh(
      new PlaneGeometry(2 * QUAD * discRadius, 2 * QUAD * discRadius),
      sunMaterial({ ...shared, uIntensity: { value: RAYS_I }, uCorona: { value: 6 } }, true),
    )
    m.name = 'sun-rays-source'
    m.matrixAutoUpdate = false
    m.frustumCulled = false
    raysSource = m
  }
  return raysSource
}

const at = new Vector3()
const forward = new Vector3()

// sun position on screen (uv) and how much of the frame keeps it: 1 inside, 0 behind the camera or past EDGE
function placeOnScreen(camera: Camera, dir: Vector3): number {
  camera.getWorldDirection(forward)
  if (forward.dot(dir) <= 0) return 0
  at.copy(camera.position).addScaledVector(dir, SUN_DIST).project(camera)
  fx.sunScreen.set(at.x * 0.5 + 0.5, at.y * 0.5 + 0.5)
  const u = fx.sunScreen
  const out = Math.max(-u.x, u.x - 1, -u.y, u.y - 1)
  return 1 - smoothstep(0, EDGE, out)
}

export function Sun() {
  const mesh = useMemo(() => {
    const m = new Mesh(
      new PlaneGeometry(2 * QUAD * discRadius, 2 * QUAD * discRadius),
      sunMaterial({ ...shared, uIntensity: { value: DISC_I }, uCorona: { value: 1 } }, false),
    )
    m.name = 'sun'
    m.renderOrder = -75
    m.frustumCulled = false
    return m
  }, [])
  // the god rays draw their source outside the scene: compile it with the rest at load
  useEffect(() => registerPrewarm(sunRaysSource()), [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      fx.sunVisible = 0
    },
    [mesh],
  )

  // after the camera (-5) and the far field (-4) have moved
  useFrame(({ camera }) => {
    const dir = lightState.sunDir
    const altM = cameraAltitudeM(camera.position.y, rig.nearOffset)
    const horizon = -horizonDip(altM)
    const above = sunAbove(lightState.sunElevation, altM)
    // the disc's color through the air in front of the camera; on the horizon it is a dim red
    sunTransmittance(altM, Math.max(lightState.sunElevation, horizon), shared.uColor.value)
    shared.uHorizon.value = horizon
    mesh.visible = above > 0
    mesh.position.copy(dir).multiplyScalar(SUN_DIST)
    mesh.quaternion.copy(camera.quaternion)

    camera.updateMatrixWorld()
    const onScreen = above > 0 ? placeOnScreen(camera, dir) : 0
    fx.sunVisible = above * onScreen

    const src = sunRaysSource()
    src.position.copy(camera.position).addScaledVector(dir, SUN_DIST)
    src.quaternion.copy(camera.quaternion)
    src.updateMatrix()
    src.updateMatrixWorld()
  })

  return <primitive object={mesh} />
}

// how strongly the sun's light reaches the camera, 0..1 (lens effects scale with it)
export function sunStrength(): number {
  const c = shared.uColor.value
  return Math.sqrt(Math.max(0, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b))
}
