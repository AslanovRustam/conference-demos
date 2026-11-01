import {
  BackSide,
  BufferAttribute,
  CircleGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  Vector3,
  type Material,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import { QUALITY } from '../quality'

// two procedural environments for image based lighting, baked once into pmrem maps (no network, no hdr files).
// pad: night sky with a twilight glow behind the rocket, warm floodlight banks around the pad, dark ground.
// space: black sky, a hard sun, blue earthshine from below.
// colors are linear radiance; anything above 1 is hdr and feeds the clearcoat glints

// where the space map puts its sun; the key light of the flight above the clouds should agree (task 10)
export const SPACE_SUN_DIR = new Vector3(-0.62, 0.38, 0.69).normalize()

const R = 50 // dome radius, inside the pmrem far plane

export function createEnvMaps(renderer: WebGLRenderer): { pad: Texture; space: Texture } {
  // three's own pmrem filter shaders make the d3d compiler print a harmless constant-folding note
  // (warning X4122) on windows; skip the program log check for the bake only
  const checkShaders = renderer.debug.checkShaderErrors
  renderer.debug.checkShaderErrors = false
  const pmrem = new PMREMGenerator(renderer)
  const targets: WebGLRenderTarget[] = []
  const bake = (build: () => Scene) => {
    const scene = build()
    try {
      const target = pmrem.fromScene(scene, 0, 0.1, 100, { size: QUALITY.envMapSize })
      targets.push(target)
      return target.texture
    } finally {
      scene.traverse((o) => {
        if (o instanceof Mesh) {
          const material: Material = o.material
          o.geometry.dispose()
          material.dispose()
        }
      })
    }
  }
  try {
    return { pad: bake(padScene), space: bake(spaceScene) }
  } catch (err) {
    for (const t of targets) t.dispose()
    throw err
  } finally {
    pmrem.dispose()
    renderer.debug.checkShaderErrors = checkShaders
  }
}

// ---------- builders ----------

const elevation = (d: Vector3) => Math.asin(Math.max(-1, Math.min(1, d.y)))
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// a sky dome colored per vertex by direction
function dome(paint: (d: Vector3, out: Color) => void): Mesh {
  const geo = new SphereGeometry(R, 192, 96)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const d = new Vector3()
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize()
    c.setRGB(0, 0, 0)
    paint(d, c)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  return new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false }))
}

// direction from azimuth (0 = +z, towards +x) and elevation, in radians
function dir(az: number, el: number): Vector3 {
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
}

// an emissive card facing the origin; nothing writes depth, so layer decides what is drawn on top
function card(scene: Scene, at: Vector3, dist: number, w: number, h: number, color: Color, layer: number, round = false): Mesh {
  const geo = round ? new CircleGeometry(w / 2, 32) : new PlaneGeometry(w, h)
  const m = new Mesh(geo, new MeshBasicMaterial({ color, side: DoubleSide, depthWrite: false }))
  m.position.copy(at).multiplyScalar(dist)
  m.lookAt(0, 0, 0)
  m.renderOrder = layer
  scene.add(m)
  return m
}

// a floodlight bank: a dim housing with a grid of hot lamps, like the stadium lights around a pad
function floodBank(scene: Scene, az: number, el: number, lamps: [number, number], intensity: number) {
  const d = dir(az, el)
  const [cols, rows] = lamps
  const pitch = 0.95
  card(scene, d, 41, cols * pitch + 0.4, rows * pitch + 0.4, new Color(0.02, 0.016, 0.012), 1)
  const lamp = new Color(1, 0.74, 0.47).multiplyScalar(intensity)
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), d).normalize()
  const up = new Vector3().crossVectors(d, right).normalize()
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const offset = right
        .clone()
        .multiplyScalar((i - (cols - 1) / 2) * pitch)
        .addScaledVector(up, (j - (rows - 1) / 2) * pitch)
      const lampDir = d.clone().multiplyScalar(40).add(offset).normalize()
      card(scene, lampDir, 40, 0.72, 0.72, lamp, 2, true)
    }
  }
}

function padScene(): Scene {
  const scene = new Scene()
  // behind the rocket as the broadcast camera sees it: a low twilight glow for warm rim reflections
  const glowDir = dir(Math.PI + 0.6, 0)
  scene.add(
    dome((d, c) => {
      const el = elevation(d)
      if (el >= 0) {
        // night sky: deep blue zenith, lighter haze at the horizon, a warm glow on one side
        const haze = Math.pow(1 - el / (Math.PI / 2), 6)
        c.setRGB(0.004 + 0.022 * haze, 0.006 + 0.03 * haze, 0.014 + 0.05 * haze)
        const g = Math.max(0, d.x * glowDir.x + d.z * glowDir.z)
        const glow = Math.pow(g, 6) * Math.pow(1 - el / (Math.PI / 2), 14)
        c.r += 0.5 * glow
        c.g += 0.2 * glow
        c.b += 0.07 * glow
        // a broken cloud deck, lit warm from below near the horizon and cold by the moon higher up
        const az = Math.atan2(d.x, d.z)
        const cloud = smooth(0.45, 0.8, cloudNoise(az * 3, el * 9)) * smooth(0.02, 0.12, el) * smooth(1.1, 0.5, el)
        const low = smooth(0.5, 0.05, el)
        c.r += cloud * (0.05 * low + 0.03)
        c.g += cloud * (0.034 * low + 0.034)
        c.b += cloud * (0.022 * low + 0.045)
      } else {
        // ground: dark asphalt with a warm pool of light near the pad
        const down = -el
        const pool = smooth(0.7, 0.05, down) * 0.035
        c.setRGB(0.005 + pool, 0.0045 + pool * 0.72, 0.004 + pool * 0.48)
      }
    }),
  )
  // floodlight banks all around the pad at different heights: they glint in the clearcoat
  const banks: [number, number, [number, number], number][] = [
    [0.3, 0.07, [5, 3], 40],
    [1.3, 0.16, [4, 3], 30],
    [2.35, 0.05, [6, 2], 45],
    [3.35, 0.24, [4, 3], 32],
    [4.3, 0.1, [5, 3], 38],
    [5.35, 0.19, [4, 2], 42],
  ]
  for (const [az, el, lamps, k] of banks) floodBank(scene, az, el, lamps, k)
  // lit service structures: tall strips that run long highlights down the hull
  for (const [az, k] of [[4.95, 3.2], [1.85, 2.2]] as const) {
    card(scene, dir(az, 0.24), 42, 1.1, 21, new Color(1, 0.86, 0.68).multiplyScalar(k), 1)
  }
  // a cold moon high up
  card(scene, dir(2.1, 0.75), 45, 3.2, 3.2, new Color(0.55, 0.65, 0.85).multiplyScalar(5), 1, true)
  return scene
}

// smooth noise for the cloud deck (sum of a few rotated sines, no texture needed)
function cloudNoise(x: number, y: number): number {
  let v = 0
  let a = 0.5
  for (let i = 0; i < 4; i++) {
    const r = 1.7 * i + 0.4
    v += a * (0.5 + 0.5 * Math.sin(x * Math.cos(r) * (i + 1) + y * Math.sin(r) * (i + 1.3) + i * 2.1))
    a *= 0.5
  }
  return v / 0.9375
}

function spaceScene(): Scene {
  const scene = new Scene()
  const limb = -0.3 // earth fills everything below this elevation
  scene.add(
    dome((d, c) => {
      const el = elevation(d)
      if (el > limb + 0.06) {
        c.setRGB(0.0004, 0.0005, 0.0009)
        return
      }
      // atmosphere limb: thin bright cyan line fading into black above
      const rim = smooth(limb + 0.06, limb, el) * smooth(limb - 0.12, limb - 0.005, el)
      // earth: deep blue, brighter towards the horizon (more air, more scattering)
      const disc = smooth(limb, limb - 0.02, el)
      const towardsLimb = smooth(-Math.PI / 2, limb, el)
      c.setRGB(
        disc * (0.05 + 0.12 * towardsLimb) + rim * 0.5,
        disc * (0.11 + 0.22 * towardsLimb) + rim * 0.85,
        disc * (0.24 + 0.38 * towardsLimb) + rim * 1.4,
      )
      // cloud bands catching sunlight on the day side
      const sunSide = Math.max(0, d.x * SPACE_SUN_DIR.x + d.z * SPACE_SUN_DIR.z)
      const bands = 0.5 + 0.5 * Math.sin(d.x * 23 + d.z * 17) * Math.sin(d.z * 31 - d.x * 9)
      c.addScalar(disc * sunSide * bands * 0.12)
    }),
  )
  // the sun: a small, very hot disc with a soft corona around it
  card(scene, SPACE_SUN_DIR, 45, 9, 9, new Color(1, 0.92, 0.8).multiplyScalar(1.4), 1, true)
  card(scene, SPACE_SUN_DIR, 44, 2.6, 2.6, new Color(1, 0.97, 0.92).multiplyScalar(400), 2, true)
  return scene
}
