import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type { Group } from 'three'

export const FAR_SKY_R = 20000
export const FAR_EARTH_D = 15000

// everything infinitely far away: the group rides with the camera, so only rotation shows.
// children draw first with depthTest and depthWrite off, ordered by renderOrder
// (sky -100, stars -90, nebulae -80, sun -75, moon -70, earth -60, aurora -55, meteors -54, atmosphere -50,
// sunrise glow -45, warp -40).
// their materials must not be transparent (additive blending works without it): three draws transparent objects
// after all opaque ones, so a far-field sprite would land on top of the rocket
export function FarField({ children }: { children?: ReactNode }) {
  const group = useRef<Group>(null)
  // after the camera rig (-5) has placed the camera
  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position)
  }, -4)
  return <group ref={group}>{children}</group>
}
