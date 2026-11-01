import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Vector3 } from 'three'
import { createRng } from '../../core/rng'
import { farAdditive } from '../far/blend'
import { registerPrewarm } from '../prewarm'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { createLimb, hitEarth, limbUniforms, LIMB_GLSL, syncLimb, updateLimb } from './limb'
import { rareShow } from './rareState'

const SPREAD_S = 3.6 // the shower's first streaks start within this many seconds of the event
const RADIANT = -2.3 // shared heading of the shower on the ground (radians off the shot's forward)

const vertexShader = /* glsl */ `
${LIMB_GLSL}
attribute vec2 corner; // x 0 tail..1 head, y across -1..1
attribute vec3 aStart; // the ground normal where it burns in (placed on the cpu, where the camera looks)
attribute vec2 aTrack; // heading, track length (radians)
attribute vec3 aTime; // start, life, brightness
uniform float uTime;
varying vec2 vC;
varying float vLife;
varying float vB;
void main() {
  float u = (uTime - aTime.x) / aTime.y;
  vC = corner;
  vLife = u;
  vB = aTime.z;
  if (u < 0.0 || u > 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside the clip volume
    return;
  }
  vec3 n0 = aStart;
  vec3 e1 = normalize(uFwd - n0 * dot(uFwd, n0));
  vec3 d = e1 * cos(aTrack.x) + cross(n0, e1) * sin(aTrack.x);
  // the head runs along the track, the glowing train grows behind it
  float train = aTrack.y * 0.4 * (0.3 + 0.7 * smoothstep(0.0, 0.3, u));
  float a = aTrack.y * u - train * (1.0 - corner.x);
  vec3 n = normalize(n0 + d * a);
  vec3 p = uC + n * uR * (1.0 + 0.013 - 0.004 * u); // burning in at ~80 km, sinking deeper
  // a ribbon facing the camera (at the origin of the far field), thinner towards the tail
  vec3 side = normalize(cross(d, p));
  p += side * corner.y * length(p) * 0.0026 * mix(0.3, 1.0, corner.x);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform float uAlpha;
varying vec2 vC;
varying float vLife;
varying float vB;
void main() {
  float x = vC.x;
  float y = vC.y;
  float train = pow(x, 2.2) * exp(-y * y * 6.0);
  float head = exp(-pow((1.0 - x) * 9.0, 2.0)) * exp(-y * y * 3.0);
  float life = smoothstep(0.0, 0.12, vLife) * (1.0 - smoothstep(0.72, 1.0, vLife));
  // the brightest ones burst at the end
  float flare = exp(-pow((vLife - 0.8) * 12.0, 2.0)) * step(0.75, vB);
  vec3 col = mix(vec3(0.8, 0.12, 0.05), vec3(1.0, 0.45, 0.12), smoothstep(0.0, 0.6, x));
  col = mix(col, vec3(1.0, 0.93, 0.8), smoothstep(0.75, 1.0, x));
  float k = (train * 2.5 + head * (6.0 + flare * 12.0)) * life * vB * uAlpha;
  gl_FragColor = vec4(col * k, 0.0);
}
`

// a meteor shower: fiery streaks burning into the atmosphere below the rocket, all from one radiant. each one
// burns in where the live camera sees the earth at that moment (far field)
export function Meteors() {
  const limb = useMemo(createLimb, [])
  const n = QUALITY.meteorCount
  const shower = useMemo(() => {
    const rng = createRng(0x6e7e)
    const start = new Float32Array(n * 3)
    const track = new Float32Array(n * 2)
    const time = new Float32Array(n * 3)
    const bright = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      track.set([RADIANT + (rng() - 0.5) * 0.5, 0.012 + 0.016 * rng()], i * 2)
      bright[i] = 0.45 + 0.55 * rng()
      time.set([(i / n) * SPREAD_S + rng() * 0.3, 0.7 + 0.9 * rng(), 0], i * 3)
    }
    return { rng, start, track, time, bright, spawned: new Uint8Array(n), lastAge: 0 }
  }, [n])
  const geo = useMemo(() => {
    const g = new InstancedBufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(12), 3)) // placed in the shader
    g.setAttribute('corner', new BufferAttribute(new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]), 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute('aStart', new InstancedBufferAttribute(shower.start, 3))
    g.setAttribute('aTrack', new InstancedBufferAttribute(shower.track, 2))
    g.setAttribute('aTime', new InstancedBufferAttribute(shower.time, 3))
    g.instanceCount = n
    return g
  }, [n, shower])
  const mat = useMemo(() => {
    const m = new ShaderMaterial({
      uniforms: { ...limbUniforms(limb), uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader,
      fragmentShader,
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

  useFrame(({ camera }) => {
    const on = rareShow.active && rareShow.kind === 'meteors'
    if (mesh.current) mesh.current.visible = on
    if (!on) return
    updateLimb(limb, rig.stageF, rig.altM)
    // a new shower starts over
    const sh = shower
    if (rareShow.age < sh.lastAge) sh.spawned.fill(0)
    sh.lastAge = rareShow.age
    let dirty = false
    for (let i = 0; i < n; i++) {
      if (sh.spawned[i] || sh.time[i * 3] > rareShow.age) continue
      sh.spawned[i] = 1
      dirty = true
      // a random point of the frame (not the top, where the hud and the sky are) down onto the earth
      tmp.ray.set(sh.rng() * 1.8 - 0.9, sh.rng() * 1.3 - 0.85, 0.5).unproject(camera).sub(camera.position).normalize()
      const hit = hitEarth(limb, tmp.ray, 1.013, tmp.hit)
      if (hit) hit.toArray(sh.start, i * 3)
      sh.time[i * 3 + 2] = hit ? sh.bright[i] : 0
    }
    if (dirty) {
      geo.attributes.aStart.needsUpdate = true
      geo.attributes.aTime.needsUpdate = true
    }
    const u = mat.uniforms as ReturnType<typeof limbUniforms> & { uTime: { value: number }; uAlpha: { value: number } }
    syncLimb(u, limb)
    u.uTime.value = rareShow.age
    u.uAlpha.value = 1
  })

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={-54} visible={false} />
}
