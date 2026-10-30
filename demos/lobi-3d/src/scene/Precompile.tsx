import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useLobby } from '../state/store'

/**
 * three compiles a shader program the first time an object is drawn, so cabinets behind the
 * logo would hitch the attract orbit when they first come into view. Compile everything once
 * the carousel is built.
 */
export default function Precompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const count = useLobby((s) => s.slots.length)

  useEffect(() => {
    if (!count) return
    const id = requestAnimationFrame(() => void gl.compileAsync(scene, camera).catch(() => {}))
    return () => cancelAnimationFrame(id)
  }, [count, gl, scene, camera])

  return null
}
