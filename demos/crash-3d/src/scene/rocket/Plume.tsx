import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { PointLight, Vector2, Vector3, type Mesh } from 'three'
import { fx, type DistortionSource } from '../fx'
import { rig } from '../rig'
import { NOZZLES } from './geometry'
import { flicker, PLUME_REF_R, plumeExpansion, plumeGeometry, plumeMaterial, setPlume, type PlumeMaterial } from './plumeShader'
import { rocketRefs } from './refs'

const LIGHT_CD = 900 // candela at full thrust
const LIGHT_Y = -3.5 // m below the exit plane, in the hot part of the flame
const HAZE_Y = -2.5 // haze center below the center nozzle, m
const HAZE_R = 6 // m around the engine cluster
const HAZE_STRENGTH = 0.006 // uv offset in screen heights at full thrust

// the outer engines sit on this radius; the merged flame starts as wide as the cluster
const CLUSTER_SPREAD = Math.max(...NOZZLES.map((n) => Math.hypot(n.x, n.z)))

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// the flame light: an orange point light under the engines that flickers with the plume and lights the rocket,
// the pad and the smoke. module level so the pad (task 9) and the clouds (task 11) can read its world position
// (plumeLight.getWorldPosition) and intensity. it stays in the scene at intensity 0 while the engines are off:
// adding or removing a light recompiles every lit material. no shadows: a point shadow is six more scene renders
export const plumeLight = new PointLight(0xff8a3c, 0, 0, 2)
plumeLight.name = 'plume-light'

const v = new Vector3()

// the engine exhaust: a jet per nozzle (core, shock diamonds, mixing layer), one merged turbulent flame for the
// cluster, the heat haze around it and the flame light; lives inside the rocket root, exhaust along -y
export function Plume() {
  const geo = useMemo(plumeGeometry, [])
  const mats = useMemo(() => {
    const jets = NOZZLES.map((n, i) => plumeMaterial({ scale: n.exitR / PLUME_REF_R, layers: 'jet', seed: i }))
    const body = plumeMaterial({ scale: 1, layers: 'body', cluster: { spread: CLUSTER_SPREAD, count: NOZZLES.length }, seed: 9 })
    return [...jets, body]
  }, [])
  const meshes = useRef<Mesh[]>([])
  const haze = useMemo<DistortionSource>(() => ({ pos: new Vector2(), radius: 0, strength: 0, ring: false }), [])

  useEffect(
    () => () => {
      geo.dispose()
      for (const m of mats) m.dispose()
    },
    [geo, mats],
  )

  // the haze source stays in the shared list while mounted; its strength is 0 when there is nothing to show
  useEffect(() => {
    fx.distortion.push(haze)
    return () => {
      const i = fx.distortion.indexOf(haze)
      if (i >= 0) fx.distortion.splice(i, 1)
    }
  }, [haze])

  useFrame(({ camera }) => {
    const thrust = rig.thrust
    const t = rig.vtime
    const on = thrust > 0.002
    const expand = plumeExpansion(rig.stageF)

    for (let i = 0; i < mats.length; i++) {
      const mesh = meshes.current[i]
      if (mesh) mesh.visible = on
      if (on) setPlume(mats[i], { thrust, expand, time: t, intensity: 0.88 + 0.24 * flicker(t, 11 + i) })
    }

    plumeLight.intensity = on ? LIGHT_CD * Math.pow(thrust, 1.3) * (0.78 + 0.44 * flicker(t)) * (1 - 0.4 * expand) : 0
    plumeLight.position.set((flicker(t, 3) - 0.5) * 0.6, LIGHT_Y + (flicker(t, 5) - 0.5) * 1.2, (flicker(t, 7) - 0.5) * 0.6)

    // heat haze needs air: it fades out on the way up through the clouds
    haze.strength = 0
    const air = 1 - smoothstep(1, 2.4, rig.stageF)
    const center = rocketRefs.nozzles[0]
    if (!on || air <= 0 || !center || !('fov' in camera)) return
    center.localToWorld(v.set(0, HAZE_Y, 0))
    const dist = v.distanceTo(camera.position)
    camera.updateMatrixWorld()
    v.project(camera)
    if (v.z >= 1 || dist <= camera.near) return
    haze.pos.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5)
    haze.radius = Math.min(1, HAZE_R / (2 * dist * Math.tan((camera.fov * Math.PI) / 360)))
    // a far-away rocket gets no shimmer: a few pixels of wobble would only smear it
    haze.strength = HAZE_STRENGTH * thrust * air * smoothstep(0.02, 0.1, haze.radius)
  })

  const mesh = (mat: PlumeMaterial, i: number, x: number, z: number) => (
    <mesh
      key={i}
      name={`plume-${i}`}
      position={[x, 0, z]}
      geometry={geo}
      material={mat}
      visible={false}
      // the vertex shader stretches the unit cone over tens of meters, the geometry bounds know nothing of it
      frustumCulled={false}
      ref={(m) => {
        if (m) meshes.current[i] = m
      }}
    />
  )

  return (
    <group name="plume">
      {NOZZLES.map((n, i) => mesh(mats[i], i, n.x, n.z))}
      {mesh(mats[NOZZLES.length], NOZZLES.length, 0, 0)}
      <primitive object={plumeLight} />
    </group>
  )
}
