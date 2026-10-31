import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { DirectionalLight, HemisphereLight } from 'three'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { updateLightState } from './lightState'

const ROCKET_MID = 24 // the shadow box is centered half way up the 48 m rocket
const KEY_DIST = 140
const SHADOW_HALF = 30 // the rocket and its plume base from any direction

// the scene's light rig: one key with shadows that follows the rocket (the moon on the pad, the sun from the dawn on),
// and a hemisphere fill (the night sky, then earthshine from below). both stay in the scene for good: adding or
// removing a light recompiles every lit material. the floodlights, the flame and the exhaust glow light the pad
export function Lights() {
  const { key, fill } = useMemo(() => {
    const key = new DirectionalLight()
    key.name = 'key-light'
    key.castShadow = true
    const s = key.shadow
    s.mapSize.set(QUALITY.keyShadowMap, QUALITY.keyShadowMap)
    s.camera.left = -SHADOW_HALF
    s.camera.right = SHADOW_HALF
    s.camera.top = SHADOW_HALF
    s.camera.bottom = -SHADOW_HALF
    s.camera.near = KEY_DIST - SHADOW_HALF * 1.8
    s.camera.far = KEY_DIST + SHADOW_HALF * 1.8
    s.bias = -0.0004
    s.normalBias = 0.035
    const fill = new HemisphereLight(0x000000, 0x000000, 1)
    fill.name = 'fill-light'
    return { key, fill }
  }, [])
  useEffect(
    () => () => {
      key.dispose()
      fill.dispose()
    },
    [key, fill],
  )

  // after the rig (-10), before the camera (-5) and everything that reads lightState
  useFrame(() => {
    const s = updateLightState(rig.stageF, rig.altM)
    key.color.copy(s.keyColor)
    key.intensity = s.keyIntensity
    // the shadow box rides the middle of the leaning rocket
    const x = Math.sin(rig.tilt) * ROCKET_MID
    const y = rig.rocketY + Math.cos(rig.tilt) * ROCKET_MID
    key.target.position.set(x, y, 0)
    key.position.copy(s.keyDir).multiplyScalar(KEY_DIST)
    key.position.x += x
    key.position.y += y
    key.target.updateMatrixWorld()
    fill.color.copy(s.fillSky)
    fill.groundColor.copy(s.fillGround)
  }, -8)

  return (
    <>
      <primitive object={key} />
      <primitive object={key.target} />
      <primitive object={fill} />
    </>
  )
}
