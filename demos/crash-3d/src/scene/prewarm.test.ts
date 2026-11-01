import { Group, Mesh, Object3D, Scene, type Camera, type WebGLRenderer } from 'three'
import { expect, test } from 'vitest'
import { isPrewarmed, prewarm, registerPrewarm } from './prewarm'

const renderless = { render: () => {}, setRenderTarget: () => {}, getRenderTarget: () => null }

test('hidden mid-round parts are shown for one synchronous compile pass and hidden again', () => {
  const scene = new Scene()
  const holder = new Group()
  holder.visible = false
  const chute = new Mesh()
  chute.visible = false
  const flash = new Mesh() // visible by default, under the hidden holder
  holder.add(chute, flash)
  scene.add(holder)
  const off = registerPrewarm(holder)

  let seen: boolean[] = []
  const gl = {
    ...renderless,
    compile: (s: Scene) => {
      const vis: Object3D[] = []
      s.traverseVisible((o) => vis.push(o))
      seen = [holder, chute, flash].map((o) => vis.includes(o))
    },
  } as unknown as WebGLRenderer

  expect(isPrewarmed()).toBe(false)
  prewarm(gl, scene, {} as Camera)
  expect(seen).toEqual([true, true, true])
  expect([holder.visible, chute.visible, flash.visible]).toEqual([false, false, true])
  expect(isPrewarmed()).toBe(true)
  off()
})

test('every hidden object of the scene compiles too, and a registered part outside the scene compiles with its lights', () => {
  const scene = new Scene()
  const earth = new Mesh()
  earth.visible = false // shown from stage 2 on
  scene.add(earth)
  const rays = new Mesh() // lives outside the scene (the god rays' source)
  rays.visible = true
  const off = registerPrewarm(rays)

  let seenEarth = false
  const calls: unknown[][] = []
  const gl = {
    ...renderless,
    compile: (s: Object3D, c: Camera, target?: Scene) => {
      calls.push([s, c, target])
      if (s === scene) s.traverseVisible((o) => (seenEarth ||= o === earth))
    },
  } as unknown as WebGLRenderer
  const camera = {} as Camera

  prewarm(gl, scene, camera)
  expect(seenEarth).toBe(true)
  expect(earth.visible).toBe(false)
  expect(calls).toContainEqual([rays, camera, scene])
  off()
})

test('one throwaway frame draws the shown scene off screen (shadow maps, texture uploads), then restores the target', () => {
  const scene = new Scene()
  const earth = new Mesh()
  earth.visible = false
  scene.add(earth)
  const targets: unknown[] = []
  let drewEarth = false
  const gl = {
    compile: () => {},
    getRenderTarget: () => 'screen',
    setRenderTarget: (t: unknown) => void targets.push(t),
    render: (s: Scene) => {
      s.traverseVisible((o) => (drewEarth ||= o === earth))
    },
  } as unknown as WebGLRenderer

  prewarm(gl, scene, {} as Camera)
  expect(drewEarth).toBe(true)
  expect(targets).toHaveLength(2)
  expect(targets[0]).not.toBe('screen')
  expect(targets[1]).toBe('screen')
  expect(earth.visible).toBe(false)
})
