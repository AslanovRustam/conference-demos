import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AddEquation,
  CustomBlending,
  Group,
  OneFactor,
  Mesh,
  PlaneGeometry,
  PointLight,
  Quaternion,
  ShaderMaterial,
  Vector3,
  ZeroFactor,
  type Object3D,
} from 'three'
import { runtime } from '../../game/runtime'
import { FX_NEAR_LAYER } from '../layers'
import { GROUND_Y } from '../pad/layout'
import { registerPrewarm } from '../prewarm'
import { plumeGeometry, plumeMaterial, setPlume, type PlumeMaterial } from '../rocket/plumeShader'
import { rocketRefs } from '../rocket/refs'
import { rig } from '../rig'
import { Fairing } from './Fairing'
import { ejectKind, retroThrust, startEject, stepEject, type EjectState } from './motion'
import { Parachute } from './Parachute'

const RETRO_SCALE = 0.08
const POD_Y = 2.5 // the rcs pods on the capsule cone (rocket/geometry.ts)
const POD_R = 1.25
const PYRO_S = 0.35 // the separation flash
const PYRO_CD = 4000
const PYRO_SIZE = 9

// a soft hot disc that always faces the camera; additive and alpha-neutral like the plume
function flashMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uLevel: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float core = exp(-r * r * 9.0);
        float halo = exp(-r * 3.0) * 0.35;
        vec3 c = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.95, 0.85), core);
        gl_FragColor = vec4(c * (core * 6.0 + halo) * uLevel, 0.0);
      }`,
    transparent: true,
    depthWrite: false,
    // pure additive light that leaves the target alpha alone (the clouds pass reads it), as the plume does
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  })
}

// the cash out: the crew capsule leaves the rocket. the capsule on the rocket hides and a copy of it flies on in
// the world (y = altitude - nearOffset), on parachutes low down or on braking thrusters higher up, while the
// adapter shell bursts into panels. rocketRefs.capsule points at the free capsule while it flies
export function Eject() {
  const holder = useRef<Group>(null) // follows the capsule's position
  const body = useRef<Group>(null) // the capsule's tumble and roll
  const state = useRef<EjectState | null>(null)
  const original = useRef<Object3D | null>(null)
  const copy = useRef<Object3D | null>(null)
  const pyroAge = useRef(PYRO_S)
  const at = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), axis: new Vector3(), tilt: new Quaternion(), roll: new Quaternion() }), [])

  const retro = useMemo(() => {
    const geo = plumeGeometry()
    const mats = [0, 1, 2, 3].map((i) => plumeMaterial({ scale: RETRO_SCALE, seed: 20 + i }))
    return { geo, mats }
  }, [])
  const retroMeshes = useRef<Mesh[]>([])
  const pyro = useMemo(() => {
    const light = new PointLight(0xffc28a, 0, 0, 2)
    const mat = flashMaterial()
    const geo = new PlaneGeometry(PYRO_SIZE, PYRO_SIZE)
    return { light, mat, geo }
  }, [])

  useEffect(
    () => () => {
      retro.geo.dispose()
      for (const m of retro.mats) m.dispose()
      pyro.mat.dispose()
      pyro.geo.dispose()
    },
    [retro, pyro],
  )

  // parachutes, thrusters and the flash compile with the scene, not on the first cash out
  useEffect(() => (holder.current ? registerPrewarm(holder.current) : undefined), [])

  useEffect(() => {
    const reset = () => {
      if (copy.current) copy.current.removeFromParent()
      copy.current = null
      if (original.current) {
        original.current.visible = true
        rocketRefs.capsule = original.current as Group
      }
      original.current = null
      state.current = null
    }
    const off = runtime.emitter.on((e) => {
      if (e.type === 'betting') reset()
      if (e.type !== 'cashout') return
      const cap = rocketRefs.capsule
      if (!cap || !body.current || !holder.current || original.current) return
      cap.updateWorldMatrix(true, false)
      cap.getWorldPosition(at.p)
      original.current = cap
      const twin = cap.clone(true)
      twin.position.set(0, 0, 0)
      twin.quaternion.identity()
      twin.visible = true
      body.current.add(twin)
      copy.current = twin
      cap.visible = false
      state.current = startEject(ejectKind(e.stage), { x: at.p.x, alt: at.p.y + rig.nearOffset, z: at.p.z }, Math.random() * Math.PI * 2)
      // the camera follows the free capsule from here
      rocketRefs.capsule = holder.current
      pyroAge.current = 0
    })
    return () => {
      off()
      reset()
    }
  }, [at])

  // before the camera (-5): high up the near field races past the free capsule, a frame late is hundreds of metres
  useFrame((_, dt) => {
    const s = state.current
    const h = holder.current
    if (!h) return
    h.visible = s !== null
    pyroAge.current += dt * rig.slowmo
    const flash = Math.max(0, 1 - pyroAge.current / PYRO_S)
    // the light stays in the scene at intensity 0: hiding a light recompiles every lit material
    pyro.light.intensity = PYRO_CD * flash * flash
    pyro.light.position.set(h.position.x, h.position.y - 0.5, h.position.z)
    pyro.mat.uniforms.uLevel.value = flash
    if (!s) return

    stepEject(s, dt * rig.slowmo)
    // touchdown: it settles on the ground and stays there until the next round
    const floor = GROUND_Y + 1
    if (s.alt < floor) {
      s.alt = floor
      s.vx = s.vy = s.vz = 0
    }
    h.position.set(s.x, s.alt - rig.nearOffset, s.z)
    if (body.current) {
      at.axis.set(-Math.sin(s.heading), 0, Math.cos(s.heading))
      at.tilt.setFromAxisAngle(at.axis, s.tilt)
      at.roll.setFromAxisAngle(at.p.set(0, 1, 0), s.spin)
      body.current.quaternion.copy(at.tilt).multiply(at.roll)
    }

    const thrust = s.kind === 'retro' ? retroThrust(s.t) : 0
    for (let i = 0; i < retro.mats.length; i++) {
      const mesh = retroMeshes.current[i]
      if (mesh) mesh.visible = thrust > 0.002
      if (thrust > 0.002) setPlume(retro.mats[i] as PlumeMaterial, { thrust, expand: 1, time: rig.vtime })
    }
  }, -6)

  return (
    <>
      <group ref={holder} name="eject" visible={false}>
        <group ref={body}>
          {/* braking thrusters on the four pods, firing forwards (up and out) to slow the capsule */}
          {retro.mats.map((mat, i) => {
            const a = (i + 0.5) * (Math.PI / 2)
            const out = new Vector3(Math.sin(a) * 0.8, 1, Math.cos(a) * 0.8).normalize()
            const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), out)
            return (
              <mesh
                key={i}
                geometry={retro.geo}
                material={mat}
                position={[Math.sin(a) * POD_R, POD_Y, Math.cos(a) * POD_R]}
                quaternion={q}
                visible={false}
                frustumCulled={false}
                ref={(m) => {
                  if (!m) return
                  retroMeshes.current[i] = m
                  m.layers.enable(FX_NEAR_LAYER)
                }}
              />
            )
          })}
        </group>
        <Parachute state={state} />
        <mesh
          geometry={pyro.geo}
          material={pyro.mat}
          position-y={-0.5}
          frustumCulled={false}
          ref={(m) => {
            m?.layers.enable(FX_NEAR_LAYER)
          }}
        />
      </group>
      <primitive object={pyro.light} />
      <Fairing />
    </>
  )
}
