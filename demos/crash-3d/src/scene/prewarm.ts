import type { Camera, Object3D, Scene, WebGLRenderer } from 'three'

// effects that only appear mid-round (the capsule's parachutes and thrusters, the fairing debris, later the explosion)
// would compile their shaders on first use and freeze the round for a moment. they register here, and once the
// scene has loaded they are shown for a single compile pass, then hidden again
const parts = new Set<Object3D>()
let done = false

export function registerPrewarm(obj: Object3D): () => void {
  parts.add(obj)
  return () => {
    parts.delete(obj)
  }
}

export function isPrewarmed(): boolean {
  return done
}

// a synchronous compile: compileAsync polls the programs until they are ready and never resolves if one of them
// is released meanwhile (a material disposed by a strict-mode remount), which would hold the ready flag forever
export function prewarm(gl: WebGLRenderer, scene: Scene, camera: Camera): void {
  const shown: Object3D[] = []
  for (const root of parts) {
    root.traverse((o) => {
      if (!o.visible) {
        o.visible = true
        shown.push(o)
      }
    })
    // a hidden ancestor would keep the part out of the traversal
    for (let p = root.parent; p; p = p.parent) {
      if (!p.visible) {
        p.visible = true
        shown.push(p)
      }
    }
  }
  try {
    gl.compile(scene, camera)
  } finally {
    for (const o of shown) o.visible = false
    done = true
  }
}
