import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AddEquation, BackSide, CustomBlending, Mesh, OneFactor, ShaderMaterial, SphereGeometry, ZeroFactor } from 'three'
import { rig } from '../rig'
import { FAR_SKY_R } from './FarField'

const FADE = [3.6, 4.2] as const

const fragmentShader = /* glsl */ `
uniform float uAlpha;
uniform float uTime;
varying vec3 vDir;
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
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.07 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
// one nebula: a soft region of the sky around a direction, filled with wispy gas and dark dust lanes
vec3 cloud(vec3 d, vec3 center, float size, vec3 gas, vec3 core, float seed) {
  float r = acos(clamp(dot(d, center), -1.0, 1.0)) / size;
  if (r > 1.6) return vec3(0.0);
  vec3 p = d * 3.2 + seed;
  // domain warp: the gas curls instead of sitting in blobs
  vec3 q = vec3(fbm(p), fbm(p + 4.1), fbm(p + 8.7));
  float n = fbm(p + 2.2 * q + vec3(0.0, uTime * 0.004, 0.0));
  float dust = smoothstep(0.45, 0.7, fbm(p * 2.3 + 11.0));
  float shape = exp(-r * r * 2.2) * smoothstep(0.32, 0.8, n);
  vec3 c = mix(gas, core, smoothstep(0.55, 0.85, n) * exp(-r * r * 4.0));
  return c * shape * (1.0 - 0.75 * dust);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = vec3(0.0);
  // two cold ones and a warm accent, spread around the horizon so most shots meet one
  col += cloud(d, normalize(vec3(0.85, 0.25, -0.45)), 0.55, vec3(0.08, 0.16, 0.42), vec3(0.45, 0.65, 1.0), 1.0);
  col += cloud(d, normalize(vec3(-0.7, 0.15, -0.7)), 0.5, vec3(0.2, 0.08, 0.38), vec3(0.55, 0.35, 0.95), 5.0);
  col += cloud(d, normalize(vec3(-0.3, 0.35, 0.9)), 0.42, vec3(0.38, 0.07, 0.16), vec3(1.0, 0.42, 0.25), 9.0);
  gl_FragColor = vec4(col * uAlpha * 0.9, 0.0);
}
`

// deep-space nebulae in the far field: procedural, domain-warped gas fading in past the orbit
export function Nebula() {
  const geo = useMemo(() => new SphereGeometry(FAR_SKY_R * 0.85, 64, 32), [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          }`,
        fragmentShader,
        side: BackSide,
        // far field: opaque list, no depth, pure added light
        transparent: false,
        depthTest: false,
        depthWrite: false,
        blending: CustomBlending,
        blendEquation: AddEquation,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: OneFactor,
      }),
    [],
  )
  const mesh = useRef<Mesh>(null)

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  useFrame(() => {
    const k = Math.min(1, Math.max(0, (rig.stageF - FADE[0]) / (FADE[1] - FADE[0])))
    if (mesh.current) mesh.current.visible = k > 0.001
    mat.uniforms.uAlpha.value = k
    mat.uniforms.uTime.value = rig.vtime
  })

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={-80} visible={false} />
}
