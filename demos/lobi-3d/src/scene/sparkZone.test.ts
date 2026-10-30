import { expect, test } from 'vitest'
import { sparkSpawn, SPARK_ZONE } from './sparkZone'

test('sparks always spawn behind the stage, never between it and the camera', () => {
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    const [x, y, z] = sparkSpawn(r, 1 - r, r)
    expect(z).toBeLessThanOrEqual(SPARK_ZONE.zNear)
    expect(z).toBeGreaterThanOrEqual(SPARK_ZONE.zFar)
    expect(Math.abs(x)).toBeLessThanOrEqual(SPARK_ZONE.halfWidth)
    expect(y).toBeGreaterThanOrEqual(0)
  }
  expect(SPARK_ZONE.zNear).toBeLessThan(-5.5) // behind the far edge of the roulette ring
})
