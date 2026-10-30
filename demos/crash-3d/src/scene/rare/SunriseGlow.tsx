import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { horizonDip } from '../env/atmosphere'
import { dirFromAzEl, lightState } from '../env/lightState'
import { farAdditive } from '../far/blend'
import { FAR_SKY_R } from '../far/FarField'
import { registerPrewarm } from '../prewarm'
import { rig } from '../rig'
import { rareShow } from './rareState'

const DEG = Math.PI / 180
const DIST = FAR_SKY_R * 0.8
const HALF_W = DIST * Math.tan(40 * DEG)
const HALF_H = DIST * Math.tan(8 * DEG)

const fragmentShader = /* glsl */ `
uniform float uI;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; // x along the horizon, y up (0 = the limb)
  float above = step(0.0, p.y);
  // the lit air hugs the limb: tall above it, cut sharply by the night side below
  float y2 = p.y * p.y * mix(260.0, 22.0, above);
  float wide = exp(-p.x * p.x * 3.0 - y2);
  float core = exp(-p.x * p.x * 60.0 - y2 * 2.5);
  float line = exp(-p.x * p.x * 1.5 - p.y * p.y * 1600.0); // the thin bright rim of the atmosphere
  vec3 c = vec3(1.0, 0.42, 0.14) * wide * 1.2 + vec3(1.0, 0.82, 0.55) * core * 4.0 + vec3(1.0, 0.7, 0.45) * line * 2.5;
  c += vec3(0.25, 0.45, 1.0) * exp(-p.x * p.x * 2.0 - pow(max(p.y - 0.25, 0.0), 2.0) * 30.0) * above * 0.25;
  gl_FragColor = vec4(c * uI, 0.0);
}
`

// the dawn flash of the sunrise event: the air on the earth's limb lights up gold where the sun breaks out of it,
// strongest as the disc clears the limb (far field; the sun disc, the god rays and the lens flare follow the sun)
export function SunriseGlow() {
  const geo = useMemo(() => new PlaneGeometry(2 * HALF_W, 2 * HALF_H), [])
  const mat = useMemo(() => {
    const m = new ShaderMaterial({
      uniforms: { uI: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader,
    })
    farAdditive(m)
    return m
  }, [])
  const mesh = useRef<Mesh>(null)
  const tmp = useMemo(() => ({ dir: new Vector3() }), [])

  useEffect(() => {
    const off = mesh.current ? registerPrewarm(mesh.current) : () => {}
    return () => {
      off()
      geo.dispose()
      mat.dispose()
    }
  }, [geo, mat])

  // after RareEvents (-9) and the lights (-8) have set the sun
  useFrame(() => {
    const m = mesh.current
    const on = rareShow.active && rareShow.kind === 'sunrise'
    if (m) m.visible = on
    if (!m || !on) return
    const s = lightState.sunDir
    const horizon = -horizonDip(rig.altM)
    dirFromAzEl(Math.atan2(s.x, s.z), horizon, tmp.dir)
    m.position.copy(tmp.dir).multiplyScalar(DIST)
    // upright on the horizon, facing the camera (the far field rides with it, unrotated)
    if (m.parent) m.lookAt(m.parent.position)
    // the sun's height over the limb in degrees: the flash peaks as it clears it
    const rel = (lightState.sunElevation - horizon) / DEG
    const p = rareShow.p
    const env = smooth(0, 0.12, p) * (1 - smooth(0.85, 1, p))
    mat.uniforms.uI.value = env * (0.25 + Math.exp(-(((rel - 0.3) / 1.4) ** 2)) * 1.3)
  })

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={-45} visible={false} />
}

function smooth(a: number, b: number, x: number) {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
