import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DodecahedronGeometry,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import { brandColors } from '@brand/tokens'
import { createRng, randomSeed } from '../../core/rng'
import { FX_NEAR_LAYER } from '../layers'
import { registerPrewarm } from '../prewarm'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { premultipliedOver, type Blast } from './blast'
import { spawnDebris, stepDebris, type DebrisPiece } from './debrisSim'

const PUFFS = 900 // smoke trail particles, in the air only
const TRAILERS = 16 // pieces that leave a trail (keeps every puff alive for its whole life in the pool)
const PUFF_LIFE_S = 1.8
const PUFF_EVERY_S = 0.035
const EMBER = new Color(1, 0.38, 0.08)

// the hull in pieces: white paint, carbon and livery red, glowing hot at first; in the air they fall and smoke
export function Debris({ blast }: { blast: { current: Blast } }) {
  const count = QUALITY.debrisPieces
  const geo = useMemo(() => new DodecahedronGeometry(0.5, 0), [])
  const mat = useMemo(
    () => new MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, emissive: EMBER, emissiveIntensity: 0 }),
    [],
  )
  const pieces = useRef<DebrisPiece[]>([])
  const mesh = useRef<InstancedMesh>(null)
  const rng = useMemo(() => createRng(randomSeed()), [])
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() }), [])
  const started = useRef(-1)

  // smoke trail points: position (near field), birth time; drawn as soft round puffs
  const trail = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new Float32Array(PUFFS * 3)
    const born = new Float32Array(PUFFS).fill(-1e6)
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('born', new BufferAttribute(born, 1))
    const m = new ShaderMaterial({
      uniforms: { uNow: { value: 0 }, uLife: { value: PUFF_LIFE_S }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float born;
        uniform float uNow;
        uniform float uLife;
        uniform float uScale;
        varying float vAge;
        void main() {
          vAge = (uNow - born) / uLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vAge < 0.0 || vAge > 1.0 ? 0.0 : uScale * (1.5 + 6.0 * vAge) / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vAge;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.2, r) * (1.0 - vAge) * 0.5;
          vec3 c = mix(vec3(0.35, 0.16, 0.06), vec3(0.11, 0.105, 0.1), clamp(vAge * 3.0, 0.0, 1.0));
          gl_FragColor = vec4(c * a, a);
        }`,
    })
    premultipliedOver(m)
    const points = new Points(g, m)
    points.frustumCulled = false
    points.layers.enable(FX_NEAR_LAYER)
    // the trail lives in absolute altitude like the pieces; the group shifts it by nearOffset
    return { g, m, points, pos, born, alt: new Float32Array(PUFFS), next: 0, clock: 0 }
  }, [])

  useEffect(() => {
    // white paint, carbon black and the livery red
    const palette = [new Color(0xf2f0ec), new Color(0xf2f0ec), new Color(0x1a1b1d), new Color(brandColors.red)]
    const m = mesh.current
    if (m) for (let i = 0; i < count; i++) m.setColorAt(i, palette[i % palette.length])
    if (m?.instanceColor) m.instanceColor.needsUpdate = true
    // compiled with the scene, not at the first crash
    const offs = [m ? registerPrewarm(m) : () => {}, registerPrewarm(trail.points)]
    return () => {
      for (const off of offs) off()
      geo.dispose()
      mat.dispose()
      trail.g.dispose()
      trail.m.dispose()
    }
  }, [count, geo, mat, trail])

  useFrame(({ size, camera }, dt) => {
    const b = blast.current
    const m = mesh.current
    if (!m) return
    if (b.active && started.current !== b.vtime0) {
      started.current = b.vtime0
      pieces.current = spawnDebris(rng, count, b)
      trail.born.fill(-1e6)
      trail.clock = 0
    }
    m.visible = b.active
    trail.points.visible = b.active && b.inAir
    if (!b.active) return
    const step = dt * rig.slowmo
    stepDebris(pieces.current, step, b.inAir)

    let heat = 0
    for (let i = 0; i < pieces.current.length; i++) {
      const p = pieces.current[i]
      heat += p.heat
      tmp.p.set(p.x, p.alt - rig.nearOffset, p.z)
      tmp.q.setFromEuler(tmp.e.set(p.rx, p.ry, p.rz))
      tmp.s.set(p.size, p.size * 0.35, p.size * 0.8) // flat shards of skin
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s))
    }
    m.instanceMatrix.needsUpdate = true
    // hdr ember glow on every piece, cooling with them
    mat.emissiveIntensity = 6 * (heat / Math.max(1, pieces.current.length)) ** 2

    if (!b.inAir) return
    const now = rig.vtime - b.vtime0
    trail.m.uniforms.uNow.value = now
    const fov = ('fov' in camera ? (camera as { fov: number }).fov : 40) * (Math.PI / 180)
    trail.m.uniforms.uScale.value = size.height / (2 * Math.tan(fov / 2))
    trail.clock += step
    while (trail.clock >= PUFF_EVERY_S) {
      trail.clock -= PUFF_EVERY_S
      for (let k = 0; k < TRAILERS && k < pieces.current.length; k++) {
        const p = pieces.current[k]
        const i = trail.next
        trail.next = (trail.next + 1) % PUFFS
        trail.pos[i * 3] = p.x
        trail.alt[i] = p.alt
        trail.pos[i * 3 + 2] = p.z
        trail.born[i] = now
      }
    }
    for (let i = 0; i < PUFFS; i++) trail.pos[i * 3 + 1] = trail.alt[i] - rig.nearOffset
    ;(trail.g.attributes.position as BufferAttribute).needsUpdate = true
    ;(trail.g.attributes.born as BufferAttribute).needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} castShadow visible={false} />
      <primitive object={trail.points} />
    </>
  )
}
