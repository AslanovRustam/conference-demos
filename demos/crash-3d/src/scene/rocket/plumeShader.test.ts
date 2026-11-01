import { expect, test } from 'vitest'
import { bakeNoise, flicker, plumeExpansion, plumeMaterial, plumeShape, setPlume, type PlumeLayers } from './plumeShader'

const jetR = (s: ReturnType<typeof plumeShape>, d: number) => s.jet[0] + (s.jet[1] + s.jet[2] * d) * d
const boundR = (s: ReturnType<typeof plumeShape>, d: number) => s.bound[0] + s.bound[1] * d

test('the bounding cone holds the flame along the whole plume', () => {
  const cases: [PlumeLayers, number, number][] = [
    ['jet', 1, 1.6],
    ['body', 1, 1.85],
    ['all', 1, 1.85],
  ]
  for (const [layers, scale, k] of cases) {
    for (const expand of [0, 0.3, 0.7, 1]) {
      for (const thrust of [0.1, 0.5, 1]) {
        const s = plumeShape(scale, thrust, expand, layers, layers === 'body' ? { spread: 1.62, count: 5 } : undefined)
        for (let i = 0; i <= 20; i++) {
          const d = (s.length * i) / 20
          expect(boundR(s, d)).toBeGreaterThanOrEqual(k * (jetR(s, d) + s.bodyOffset) - 1e-9)
        }
      }
    }
  }
})

test('the flame grows with thrust and opens up in vacuum', () => {
  const low = plumeShape(1, 0.2, 0)
  const sea = plumeShape(1, 1, 0)
  const vac = plumeShape(1, 1, 1)
  expect(sea.length).toBeGreaterThan(low.length)
  expect(vac.length).toBeGreaterThan(sea.length)
  expect(jetR(vac, 10)).toBeGreaterThan(3 * jetR(sea, 10))
  // a jet cone is a short near-field piece of the full plume
  expect(plumeShape(1, 1, 0, 'jet').length).toBeLessThan(sea.length / 2)
})

test('scale shrinks every length with the nozzle', () => {
  const big = plumeShape(1, 1, 0.5)
  const small = plumeShape(0.08, 1, 0.5)
  expect(small.r0).toBeCloseTo(big.r0 * 0.08)
  expect(small.length).toBeCloseTo(big.length * 0.08)
  expect(jetR(small, small.length)).toBeCloseTo(jetR(big, big.length) * 0.08)
})

test('expansion is dense at the pad, vacuum by stage 3.2, and never goes back', () => {
  expect(plumeExpansion(0)).toBe(0)
  expect(plumeExpansion(1.05)).toBe(0)
  expect(plumeExpansion(3.3)).toBe(1)
  let prev = 0
  for (let f = 0; f <= 6; f += 0.05) {
    const e = plumeExpansion(f)
    expect(e).toBeGreaterThanOrEqual(prev)
    prev = e
  }
})

test('flicker stays in 0..1 and moves smoothly', () => {
  let prev = flicker(0)
  for (let t = 0; t < 5; t += 0.004) {
    const v = flicker(t, 3)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
    if (t > 0) expect(Math.abs(v - prev)).toBeLessThan(0.1)
    prev = v
  }
})

test('the noise green channel is the red lattice one z slice on, wrapping at the edges', () => {
  const size = 16
  const tex = bakeNoise(size, 7)
  expect(tex).toHaveLength(size * size * 2)
  for (const [x, y] of [[0, 0], [5, 9], [15, 15], [12, 2]]) {
    const g = tex[(y * size + x) * 2 + 1]
    const r = tex[(((y + 17) % size) * size + ((x + 37) % size)) * 2]
    expect(g).toBe(r)
  }
})

test('the turbulence flows on smoothly while the plume opens up, even after hours of uptime', () => {
  const mat = plumeMaterial({ scale: 1, layers: 'body', cluster: { spread: 1.62, count: 5 } })
  const flow = mat.uniforms.uFlow.value
  // the first update after a long uptime starts from where it is, without a jump
  setPlume(mat, { thrust: 1, expand: 0, time: 36_000 })
  expect(flow.x).toBe(0)
  let prev = flow.x
  for (let i = 1; i <= 600; i++) {
    setPlume(mat, { thrust: 1, expand: i / 600, time: 36_000 + i / 60 })
    const step = (flow.x - prev + 256) % 256
    expect(step).toBeGreaterThan(0)
    expect(step).toBeLessThan(0.1) // at most 10 * 0.45 cells per second
    expect(flow.x).toBeLessThan(256)
    expect(flow.y).toBeLessThan(256)
    prev = flow.x
  }
  // a hidden tab coming back does not fast-forward it
  setPlume(mat, { thrust: 1, expand: 1, time: 40_000 })
  expect((flow.x - prev + 256) % 256).toBeLessThan(0.1)
  mat.dispose()
})
