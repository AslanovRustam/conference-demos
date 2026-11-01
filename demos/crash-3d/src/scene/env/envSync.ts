import type { MeshStandardMaterial, Scene, Texture } from 'three'

// three applies a material's envMapIntensity (and envMapRotation) only when the material has its own envMap; with
// scene.environment alone every material reflects the environment at scene.environmentIntensity. so the pad and the
// rocket register their materials here: each takes the scene environment as its own envMap (the same texture, no
// shader recompiles) and its envMapIntensity counts, scaled by the flight's environment strength.
// materials that do not register follow scene.environmentIntensity / environmentRotation, kept in step
class EnvLit {
  private base = new Map<MeshStandardMaterial, number>()

  // remembers the material's own envMapIntensity as its base
  add(m: MeshStandardMaterial): void {
    if (!this.base.has(m)) this.base.set(m, m.envMapIntensity)
  }

  delete(m: MeshStandardMaterial): void {
    const b = this.base.get(m)
    if (b === undefined) return
    m.envMapIntensity = b
    this.base.delete(m)
  }

  get size(): number {
    return this.base.size
  }

  sync(scene: Scene, env: Texture | null, scale: number, rotationY: number): void {
    scene.environmentIntensity = scale
    scene.environmentRotation.y = rotationY
    for (const [m, b] of this.base) {
      if (m.envMap !== env) m.envMap = env
      m.envMapIntensity = b * scale
      m.envMapRotation.y = rotationY
    }
  }
}

export const envLit = new EnvLit()
