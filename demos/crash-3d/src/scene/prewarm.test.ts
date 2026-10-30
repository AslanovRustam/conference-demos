import { Group, Mesh, Object3D, Scene, type Camera, type WebGLRenderer } from 'three'
import { expect, test } from 'vitest'
import { isPrewarmed, prewarm, registerPrewarm } from './prewarm'

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
