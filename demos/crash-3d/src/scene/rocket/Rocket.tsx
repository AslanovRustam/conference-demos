import { useFrame, useThree } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Group, Object3D, Texture } from 'three'
import { createEnvMaps } from '../env/environment'
import { rig } from '../rig'
import { buildRocketGeometry, DIM, NOZZLES } from './geometry'
import { createRocketMaterials } from './materials'
import { rocketRefs } from './refs'
import { loadRocketTextures } from './textures'

// the space reflections take over while the rocket is inside the cloud layer, so the swap is never seen
const SPACE_ENV_STAGE = 1.6

// the hero rocket: procedural geometry, pbr materials, canvas textures; suspends until the textures exist
export function Rocket() {
  const textures = use(loadRocketTextures())
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const geo = useMemo(buildRocketGeometry, [])
  const mats = useMemo(() => createRocketMaterials(textures), [textures])
  const env = useRef<{ pad: Texture; space: Texture } | null>(null)
  const root = useRef<Group>(null)
  const capsule = useRef<Group>(null)
  const fairing = useRef<Group>(null)
  const nozzles = useRef<Object3D[]>([])

  useEffect(() => {
    const maps = createEnvMaps(gl)
    env.current = maps
    return () => {
      env.current = null
      if (scene.environment === maps.pad || scene.environment === maps.space) scene.environment = null
      maps.pad.dispose()
      maps.space.dispose()
    }
  }, [gl, scene])

  useEffect(
    () => () => {
      const { capsule: parts, ...rest } = geo
      for (const g of [...Object.values(rest), ...Object.values(parts)]) g.dispose()
      for (const m of Object.values(mats)) m.dispose()
    },
    [geo, mats],
  )

  useLayoutEffect(() => {
    rocketRefs.root = root.current
    rocketRefs.capsule = capsule.current
    rocketRefs.fairing = fairing.current
    rocketRefs.nozzles = [...nozzles.current]
    return () => {
      rocketRefs.root = null
      rocketRefs.capsule = null
      rocketRefs.fairing = null
      rocketRefs.nozzles = []
    }
  }, [])

  useFrame(() => {
    if (root.current) root.current.position.y = rig.rocketY
    const maps = env.current
    if (maps) scene.environment = rig.stageF >= SPACE_ENV_STAGE ? maps.space : maps.pad
  })

  const c = geo.capsule
  return (
    <group ref={root} name="rocket">
      <mesh geometry={geo.hull} material={mats.hull} castShadow receiveShadow />
      <mesh geometry={geo.raceways} material={mats.hull} castShadow receiveShadow />
      <mesh geometry={geo.interstage} material={mats.carbon} castShadow receiveShadow />
      <mesh geometry={geo.rings} material={mats.metal} castShadow receiveShadow />
      <mesh geometry={geo.fins} material={mats.carbon} castShadow receiveShadow />
      <mesh geometry={geo.baseShield} material={mats.base} receiveShadow />
      <mesh geometry={geo.boots} material={mats.boot} />
      <mesh geometry={geo.bells} material={mats.nozzle} castShadow receiveShadow />
      {NOZZLES.map((n, i) => (
        <object3D
          key={i}
          name={`nozzle-${i}`}
          position={[n.x, 0, n.z]}
          ref={(o) => {
            if (o) nozzles.current[i] = o
          }}
        />
      ))}
      <group ref={fairing} name="fairing" position-y={DIM.stage2Top}>
        <mesh geometry={geo.fairing} material={mats.hull} castShadow receiveShadow />
      </group>
      <group ref={capsule} name="capsule" position-y={DIM.capsuleBase}>
        <mesh geometry={c.shield} material={mats.shield} castShadow receiveShadow />
        <mesh geometry={c.body} material={mats.hull} castShadow receiveShadow />
        <mesh geometry={c.tower} material={mats.hull} castShadow receiveShadow />
        <mesh geometry={c.struts} material={mats.metal} castShadow />
        <mesh geometry={c.abortBells} material={mats.nozzle} />
        <mesh geometry={c.pods} material={mats.carbon} castShadow />
        <mesh geometry={c.frames} material={mats.frame} />
        <mesh geometry={c.windows} material={mats.glass} />
        <mesh geometry={c.decal} material={mats.logo} />
      </group>
    </group>
  )
}
