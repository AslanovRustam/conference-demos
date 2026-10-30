import { useFrame, useThree } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Group, Object3D, Texture } from 'three'
import { createEnvMaps } from '../env/environment'
import { envLit } from '../env/envSync'
import { lightState, SPACE_ENV_STAGE } from '../env/lightState'
import { rig } from '../rig'
import { buildRocketGeometry, DIM, NOZZLES } from './geometry'
import { createRocketMaterials } from './materials'
import { Plume } from './Plume'
import { rocketRefs } from './refs'
import { disposeRocketTextures, loadRocketTextures } from './textures'

// the hero rocket: procedural geometry, pbr materials, canvas textures; suspends until the textures exist
export function Rocket() {
  // the promise is pinned per instance: unmount resets the shared cache, and a dev strict-mode
  // remount (or a later re-render) must not start a second build
  const [texturesReady] = useState(loadRocketTextures)
  const textures = use(texturesReady)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const geo = useMemo(buildRocketGeometry, [])
  const mats = useMemo(() => createRocketMaterials(textures), [textures])
  const env = useRef<{ pad: Texture; space: Texture } | null>(null)
  const root = useRef<Group>(null)
  const hull = useRef<Group>(null)
  const capsule = useRef<Group>(null)
  const fairing = useRef<Group>(null)
  const nozzles = useRef<Object3D[]>([])

  useEffect(() => {
    const maps = createEnvMaps(gl)
    env.current = maps
    return () => {
      env.current = null
      if (scene.environment === maps.pad || scene.environment === maps.space) {
        scene.environment = null
        envLit.sync(scene, null, 1, 0)
      }
      maps.pad.dispose()
      maps.space.dispose()
    }
  }, [gl, scene])

  // the rocket's materials take the environment as their own envMap, so their envMapIntensity counts (env/envSync.ts)
  useLayoutEffect(() => {
    const all = Object.values(mats)
    for (const m of all) envLit.add(m)
    return () => {
      for (const m of all) envLit.delete(m)
    }
  }, [mats])

  useEffect(
    () => () => {
      const { capsule: parts, ...rest } = geo
      for (const g of [...Object.values(rest), ...Object.values(parts)]) g.dispose()
      for (const m of Object.values(mats)) m.dispose()
      disposeRocketTextures()
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

  // before the default priority: the plume and later scene parts read the rocket's world transform.
  // reflections: the night pad until the sun is up, then space; strength and turn from the light state (Lights, -8)
  useFrame(() => {
    if (root.current) root.current.position.y = rig.rocketY
    // blown up: the hull is gone until the next round (the plume and its light stay, at thrust 0)
    if (hull.current) hull.current.visible = rig.crashAge === null
    const maps = env.current
    if (!maps) return
    const next = rig.stageF >= SPACE_ENV_STAGE ? maps.space : maps.pad
    if (scene.environment !== next) scene.environment = next
    envLit.sync(scene, next, lightState.envScale, lightState.envRotation)
  }, -1)

  const c = geo.capsule
  return (
    <group ref={root} name="rocket">
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
      <Plume />
      {/* everything that blows up; the plume and its light stay outside */}
      <group ref={hull} name="hull">
        <mesh geometry={geo.hull} material={mats.hull} castShadow receiveShadow />
        <mesh geometry={geo.raceways} material={mats.hull} castShadow receiveShadow />
        <mesh geometry={geo.interstage} material={mats.carbon} castShadow receiveShadow />
        <mesh geometry={geo.rings} material={mats.metal} castShadow receiveShadow />
        <mesh geometry={geo.fins} material={mats.carbon} castShadow receiveShadow />
        <mesh geometry={geo.baseShield} material={mats.base} receiveShadow />
        <mesh geometry={geo.boots} material={mats.boot} />
        <mesh geometry={geo.bells} material={mats.nozzle} castShadow receiveShadow />
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
    </group>
  )
}
