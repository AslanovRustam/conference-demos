import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Studio reflections for chrome, ceramic and glass. Built procedurally from three's
 * RoomEnvironment: no HDR download, so the lobby stays offline-ready.
 */
export default function StudioEnvironment({ intensity = 1 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = null
      target.dispose()
      room.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, intensity])

  return null
}
