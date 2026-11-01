import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three'
import { shotFrame } from '../camera/shotFrame'
import { farAdditive } from '../far/blend'
import { registerPrewarm } from '../prewarm'
import { rig } from '../rig'
import { createLimb, hitEarth, limbUniforms, LIMB_GLSL, syncLimb, updateLimb } from './limb'
import { rareShow } from './rareState'

const RIBBONS = 3
const SEG = 240 // along each curtain
const ROWS = 10 // up each curtain

const vertexShader = /* glsl */ `
${LIMB_GLSL}
attribute vec3 strip; // along -1..1, up 0..1, ribbon
uniform float uTime;
uniform float uTheta; // the curtains' ground angle from the point under the camera
varying vec2 vSH;
varying float vK;
void main() {
  float s = strip.x;
  float h = strip.y;
  float k = strip.z;
  // curtains standing on the limb in front of the shot; the base wanders towards and away from the camera (folds)
  float fold = sin(s * 5.0 + uTime * 0.35 + k * 2.1) * 0.035 + sin(s * 13.0 - uTime * 0.6 + k * 1.3) * 0.012;
  vec3 n = limbNormal(uTheta * (1.0 - 0.05 * k + fold), s * 0.95);
  // ~90 km at the foot, up to ~300 km
  float alt = 0.014 + h * (0.03 + 0.008 * sin(s * 3.0 + k));
  vSH = vec2(s, h);
  vK = k;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(uC + n * uR * (1.0 + alt), 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
varying vec2 vSH;
varying float vK;
float hash(float n) {
  return fract(sin(n) * 43758.5453);
}
float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}
void main() {
  float s = vSH.x;
  float h = vSH.y;
  // vertical rays drifting along the curtain, in slower brighter patches
  float rays = 0.35 + 0.65 * noise(s * 90.0 + uTime * 0.8 + vK * 17.0);
  rays *= 0.5 + 0.5 * noise(s * 21.0 - uTime * 0.3 + vK * 5.0);
  float foot = smoothstep(0.0, 0.05, h);
  float top = 1.0 - smoothstep(0.2, 1.0, h);
  float ends = 1.0 - smoothstep(0.5, 1.0, abs(s));
  // oxygen green low, violet and red at the top, a bright lower fringe
  vec3 col = mix(vec3(0.12, 1.0, 0.42), vec3(0.55, 0.14, 0.85), smoothstep(0.25, 0.85, h));
  col += vec3(0.7, 1.0, 0.8) * (1.0 - smoothstep(0.0, 0.1, h)) * 0.7;
  float pulse = 0.75 + 0.25 * sin(uTime * 1.3 + s * 4.0 + vK * 2.0);
  gl_FragColor = vec4(col * foot * top * ends * rays * pulse * uAlpha * 1.8, 0.0);
}
`

// green and violet curtains of the aurora, waving and shimmering, standing on the earth's limb in front of the shot;
// once the earth swings into the frame and the limb leaves it, they move onto the disc where the shot looks (far field)
const LOOK_DOWN = (10 * Math.PI) / 180
export function Aurora() {
  const limb = useMemo(createLimb, [])
  const geo = useMemo(() => {
    const per = (SEG + 1) * (ROWS + 1)
    const strip = new Float32Array(RIBBONS * per * 3)
    const index: number[] = []
    for (let k = 0; k < RIBBONS; k++) {
      for (let j = 0; j <= ROWS; j++) {
        for (let i = 0; i <= SEG; i++) strip.set([(i / SEG) * 2 - 1, j / ROWS, k], (k * per + j * (SEG + 1) + i) * 3)
      }
      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < SEG; i++) {
          const a = k * per + j * (SEG + 1) + i
          const b = a + SEG + 1
          index.push(a, b, a + 1, a + 1, b, b + 1)
        }
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(strip.length), 3)) // placed in the shader
    g.setAttribute('strip', new BufferAttribute(strip, 3))
    g.setIndex(index)
    return g
  }, [])
  const mat = useMemo(() => {
    const m = new ShaderMaterial({
      uniforms: { ...limbUniforms(limb), uTime: { value: 0 }, uAlpha: { value: 0 }, uTheta: { value: 0 } },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
    })
    farAdditive(m)
    return m
  }, [limb])
  const mesh = useRef<Mesh>(null)
  const tmp = useMemo(() => ({ ray: new Vector3(), hit: new Vector3() }), [])

  useEffect(() => {
    const off = mesh.current ? registerPrewarm(mesh.current) : () => {}
    return () => {
      off()
      geo.dispose()
      mat.dispose()
    }
  }, [geo, mat])

  useFrame(() => {
    const on = rareShow.active && rareShow.kind === 'aurora'
    if (mesh.current) mesh.current.visible = on
    if (!on) return
    updateLimb(limb, rig.stageF, rig.altM)
    const u = mat.uniforms as ReturnType<typeof limbUniforms> & { uTime: { value: number }; uAlpha: { value: number }; uTheta: { value: number } }
    syncLimb(u, limb)
    const f = shotFrame.forward
    tmp.ray.set(f.x, 0, f.z).normalize().multiplyScalar(Math.cos(LOOK_DOWN)).setY(-Math.sin(LOOK_DOWN))
    const hit = hitEarth(limb, tmp.ray, 1, tmp.hit)
    u.uTheta.value = Math.min(limb.thetaH * 0.93, hit ? Math.acos(Math.min(1, hit.dot(limb.up))) : Infinity)
    u.uTime.value = rig.vtime
    const p = rareShow.p
    u.uAlpha.value = smooth(0, 0.2, p) * (1 - smooth(0.75, 1, p))
  })

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={-55} visible={false} />
}

function smooth(a: number, b: number, x: number) {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
