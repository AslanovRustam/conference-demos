import { useFrame } from '@react-three/fiber'
import { MAX_DT } from '../core/config'
import { useGame } from '../game/store'
import { computeRig, rig } from './rig'

// refreshes the shared rig first thing every frame (priority -10), before the camera and the scene read it
export function RigUpdater() {
  useFrame((_, delta) => {
    Object.assign(rig, computeRig(rig, useGame.getState().snap, Math.min(delta, MAX_DT)))
  }, -10)
  return null
}
