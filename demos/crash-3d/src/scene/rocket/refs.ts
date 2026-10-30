import type { Group, Object3D } from 'three'

export const ROCKET_HEIGHT_M = 48

// live scene nodes of the rocket, filled when <Rocket /> mounts:
// - root: the whole rocket, origin at the nozzle exit plane (y = 0), stands at rig.rocketY
// - capsule: crew capsule with the escape tower, origin at its base, child of root until the eject
// - fairing: adapter shell between the upper stage and the capsule, origin at its base
// - nozzles: [center, +z, +x, -z, -x], each at the center of its exit plane; exhaust goes along local -y
export const rocketRefs = {
  root: null as Group | null,
  capsule: null as Group | null,
  nozzles: [] as Object3D[],
  fairing: null as Group | null,
}
