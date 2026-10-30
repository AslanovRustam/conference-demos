// Where the red sparks live: a wide band behind the carousel. Spawning them all around the hall
// put some between the stage and the camera, where they read as dust on the screen.

export const SPARK_ZONE = { halfWidth: 16, zNear: -6.5, zFar: -18, height: 7 } as const

/** Spawn position from three uniform randoms in [0, 1). */
export function sparkSpawn(r1: number, r2: number, r3: number): [number, number, number] {
  const { halfWidth, zNear, zFar, height } = SPARK_ZONE
  return [(r1 * 2 - 1) * halfWidth, r2 * height, zNear + r3 * (zFar - zNear)]
}
