import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { IcosahedronGeometry, Mesh, ShaderMaterial } from 'three'
import { FX_NEAR_LAYER } from '../layers'
import { rig } from '../rig'
import { NOISE_GLSL, premultipliedOver, type Blast } from './blast'
import { crashTimeline } from './timeline'

// lobes of the fireball: offset (in fireball radii), size and a phase so they boil differently
const LOBES = [
  { x: 0, y: 0, z: 0, s: 1, seed: 0 },
  { x: 0.55, y: 0.25, z: 0.1, s: 0.62, seed: 3.1 },
  { x: -0.45, y: 0.35, z: -0.3, s: 0.55, seed: 5.7 },
  { x: 0.1, y: -0.5, z: 0.45, s: 0.5, seed: 8.3 },
]
const SMOKE_SCALE = 1.5 // the smoke shell around it, in the air only

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uBoil;
varying float vNoise;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
${NOISE_GLSL}
void main() {
  float n = fbm(position * 1.7 + vec3(uSeed) + vec3(0.0, uTime * 0.9, 0.0));
  vNoise = n;
  vLocal = position;
  vec3 p = position * (1.0 + uBoil * (n - 0.45));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const fragmentShader = /* glsl */ `
uniform float uHeat;
uniform float uAlpha;
uniform float uSmoke;
uniform float uTime;
uniform float uSeed;
varying float vNoise;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
${NOISE_GLSL}
// temperature ramp: soot, deep red, saturated orange, yellow, a small white core. kept moderate and strongly
// tinted: the AgX tone mapping bleaches very bright colors towards white, the fire must stay orange
vec3 ramp(float t) {
  vec3 c = mix(vec3(0.02, 0.018, 0.016), vec3(0.42, 0.035, 0.01), smoothstep(0.05, 0.3, t));
  c = mix(c, vec3(2.1, 0.42, 0.03), smoothstep(0.25, 0.55, t));
  c = mix(c, vec3(3.2, 1.45, 0.22), smoothstep(0.55, 0.82, t));
  return mix(c, vec3(5.0, 3.6, 1.6), smoothstep(0.85, 1.0, t));
}
void main() {
  float facing = abs(dot(normalize(vNormal), vView));
  float rim = 1.0 - facing;
  // fine turbulence on top of the boiling shape: dark soot veins and hot cracks
  float detail = fbm(vLocal * 4.5 + vec3(uSeed, uTime * 1.4, 0.0));
  float n = clamp(vNoise * 0.6 + detail * 0.8 - 0.15, 0.0, 1.0);
  // hotter in the middle and in the crests, the edges cool into smoke
  float t = uHeat * (0.25 + 1.15 * n) * (1.0 - 0.7 * rim);
  vec3 c = uSmoke > 0.5 ? vec3(0.05, 0.046, 0.042) * (0.5 + n) : ramp(clamp(t, 0.0, 1.0));
  // ragged edges: the silhouette eats into the noise
  float a = uAlpha * smoothstep(0.1, 0.55, facing * 0.75 + n * 0.55);
  if (uSmoke > 0.5) a *= 0.6;
  gl_FragColor = vec4(c * a, a);
}
`

function fireMaterial(seed: number, smoke: boolean): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uBoil: { value: smoke ? 0.5 : 0.95 },
      uHeat: { value: 1 },
      uAlpha: { value: 1 },
      uSmoke: { value: smoke ? 1 : 0 },
    },
    vertexShader,
    fragmentShader,
  })
  premultipliedOver(m)
  return m
}

// the boiling fireball: displaced noisy lobes glowing by temperature, wrapped in smoke when it happens in the air
export function Fireball({ blast }: { blast: { current: Blast } }) {
  const geo = useMemo(() => new IcosahedronGeometry(1, 24), [])
  const fire = useMemo(() => LOBES.map((l) => fireMaterial(l.seed, false)), [])
  const smoke = useMemo(() => fireMaterial(11, true), [])
  const meshes = useRef<Mesh[]>([])
  const smokeMesh = useRef<Mesh>(null)

  useEffect(
    () => () => {
      geo.dispose()
      for (const m of fire) m.dispose()
      smoke.dispose()
    },
    [geo, fire, smoke],
  )

  useFrame(() => {
    const b = blast.current
    if (!b.active) return
    const beat = crashTimeline(rig.vtime - b.vtime0, b.short)
    const t = rig.vtime - b.vtime0
    LOBES.forEach((l, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      const r = beat.fireRadius * l.s
      mesh.scale.setScalar(Math.max(0.01, r))
      mesh.position.set(l.x * beat.fireRadius, l.y * beat.fireRadius, l.z * beat.fireRadius)
      const u = fire[i].uniforms
      u.uTime.value = t
      // the side lobes burn out a little sooner
      u.uHeat.value = beat.fireHeat * (i === 0 ? 1 : 0.85)
      u.uAlpha.value = beat.fireAlpha
    })
    const s = smokeMesh.current
    if (s) {
      s.visible = b.inAir
      s.scale.setScalar(Math.max(0.01, beat.fireRadius * SMOKE_SCALE * (1 + 0.4 * (1 - beat.fireHeat))))
      smoke.uniforms.uTime.value = t * 0.5
      smoke.uniforms.uAlpha.value = Math.min(1, (1 - beat.fireHeat) * 1.6) * beat.fireAlpha
    }
  })

  const near = (m: Mesh | null) => m?.layers.enable(FX_NEAR_LAYER)
  return (
    <group>
      <mesh ref={smokeMesh} geometry={geo} material={smoke} frustumCulled={false} renderOrder={1} />
      {fire.map((mat, i) => (
        <mesh
          key={i}
          geometry={geo}
          material={mat}
          frustumCulled={false}
          renderOrder={2}
          ref={(m) => {
            if (!m) return
            meshes.current[i] = m
            near(m)
          }}
        />
      ))}
    </group>
  )
}
