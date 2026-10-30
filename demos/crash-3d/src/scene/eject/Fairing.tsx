import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CylinderGeometry, Euler, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type Material } from 'three'
import { runtime } from '../../game/runtime'
import { DIM } from '../rocket/geometry'
import { registerPrewarm } from '../prewarm'
import { rocketRefs } from '../rocket/refs'
import { rig } from '../rig'

const PIECES = 16
const RINGS = 2 // two rows of panels around the adapter
const PANEL_H = 1.3
const LIFE_S = 6
const G_AIR = 9.81
const G_HIGH = 1.2

interface Piece {
  x: number
  alt: number
  z: number
  vx: number
  vy: number
  vz: number
  rot: Euler
  spin: Vector3
}

// the adapter shell blows apart into panels when the capsule leaves; they tumble away in the rocket's wake
export function Fairing() {
  const geo = useMemo(() => {
    const g = new CylinderGeometry(DIM.r, DIM.r, PANEL_H, 6, 1, true, 0, (Math.PI * 2) / (PIECES / RINGS))
    g.translate(0, PANEL_H / 2, 0)
    return g
  }, [])
  const mesh = useRef<InstancedMesh>(null)
  const pieces = useRef<Piece[]>([])
  const age = useRef(LIFE_S)
  const gravity = useRef(G_AIR)
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(1, 1, 1), base: new Vector3() }), [])

  useEffect(() => () => geo.dispose(), [geo])

  // the panels wear the shell's own paint from the start, so the prewarm compiles the right (instanced) shader
  useEffect(() => {
    const skin = (rocketRefs.fairing?.children[0] as Mesh | undefined)?.material as Material | undefined
    if (skin && mesh.current) mesh.current.material = skin
    return mesh.current ? registerPrewarm(mesh.current) : undefined
  }, [])

  useEffect(
    () =>
      runtime.emitter.on((e) => {
        const shell = rocketRefs.fairing
        if (e.type === 'betting') {
          if (shell) shell.visible = true
          age.current = LIFE_S
          return
        }
        if (e.type !== 'cashout' || !shell || !mesh.current) return
        // the panels take the shell's own paint
        const skin = (shell.children[0] as Mesh | undefined)?.material as Material | undefined
        if (skin) mesh.current.material = skin
        shell.getWorldPosition(tmp.base)
        shell.visible = false
        gravity.current = e.stage <= 1 ? G_AIR : G_HIGH
        const perRing = PIECES / RINGS
        pieces.current = Array.from({ length: PIECES }, (_, i) => {
          const a = ((i % perRing) / perRing) * Math.PI * 2
          const out = 6 + Math.random() * 9
          return {
            x: tmp.base.x,
            alt: tmp.base.y + rig.nearOffset + Math.floor(i / perRing) * PANEL_H,
            z: tmp.base.z,
            vx: Math.sin(a) * out,
            vy: 3 + Math.random() * 5,
            vz: Math.cos(a) * out,
            rot: new Euler(0, a, 0),
            spin: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6),
          }
        })
        age.current = 0
      }),
    [tmp],
  )

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    const step = dt * rig.slowmo
    age.current += step
    m.visible = age.current < LIFE_S
    if (!m.visible) return
    for (let i = 0; i < pieces.current.length; i++) {
      const p = pieces.current[i]
      p.vy -= gravity.current * step
      p.x += p.vx * step
      p.alt += p.vy * step
      p.z += p.vz * step
      p.rot.x += p.spin.x * step
      p.rot.y += p.spin.y * step
      p.rot.z += p.spin.z * step
      tmp.p.set(p.x, p.alt - rig.nearOffset, p.z)
      tmp.q.setFromEuler(p.rot)
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s))
    }
    m.instanceMatrix.needsUpdate = true
  })

  // starts with the shared hull paint once a cash out happens; frustum culling off since the panels scatter
  return <instancedMesh ref={mesh} args={[geo, undefined, PIECES]} visible={false} frustumCulled={false} castShadow />
}
