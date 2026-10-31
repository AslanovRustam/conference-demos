import { WebGLRenderTarget, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three'

// anything that first appears mid-round (the plume at ignition, the earth, moon, nebulae and warp further up, the
// capsule's parachutes and thrusters, the explosion, the rare events) would compile its shaders on first use and
// freeze the round for a second or more on D3D11. once the scene has loaded, every hidden object of it is shown for a
// single compile pass, then hidden again. parts that live outside the scene (the god rays' source) register here and
// compile against the scene's lights
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

function rootOf(o: Object3D): Object3D {
  let r = o
  while (r.parent) r = r.parent
  return r
}

// a synchronous compile: compileAsync polls the programs until they are ready and never resolves if one of them
// is released meanwhile (a material disposed by a strict-mode remount), which would hold the ready flag forever.
// then one throwaway frame of the whole shown scene into a tiny target: compile only builds the draw programs, the
// shadow-map depth variants, the texture uploads (the 8K earth) and per-object variants wait for a real draw
export function prewarm(gl: WebGLRenderer, scene: Scene, camera: Camera): void {
  const shown: Object3D[] = []
  const show = (o: Object3D) => {
    if (o.visible) return
    o.visible = true
    shown.push(o)
  }
  scene.traverse(show)
  const outside: Object3D[] = []
  for (const root of parts) {
    root.traverse(show)
    // a hidden ancestor would keep the part out of the traversal
    for (let p = root.parent; p; p = p.parent) show(p)
    if (rootOf(root) !== scene) outside.push(root)
  }
  try {
    gl.compile(scene, camera)
    for (const root of outside) gl.compile(root, camera, scene)
    const target = new WebGLRenderTarget(64, 64)
    const was = gl.getRenderTarget()
    try {
      gl.setRenderTarget(target)
      gl.render(scene, camera)
    } finally {
      gl.setRenderTarget(was)
      target.dispose()
    }
  } finally {
    for (const o of shown) o.visible = false
    done = true
  }
}
