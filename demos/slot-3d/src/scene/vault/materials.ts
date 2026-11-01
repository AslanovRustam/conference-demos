import * as THREE from 'three'

/** door and frame finish; `?look=brass` switches to the bronze bank-vault variant */
export type VaultLook = 'silver' | 'brass'

const query = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search)
export const LOOK: VaultLook = query.get('look') === 'brass' ? 'brass' : 'silver'

// ---------------------------------------------------------------- procedural textures

function canvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, color = true) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!, size)
  const tex = new THREE.CanvasTexture(c)
  if (color) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** concentric machining marks for round faces (cylinder caps map UVs as a disc) */
function circularBrush() {
  return canvas(
    1024,
    (ctx, s) => {
      ctx.fillStyle = 'rgb(120,120,120)'
      ctx.fillRect(0, 0, s, s)
      for (let r = 2; r < s * 0.72; r += 1.5) {
        const v = 95 + Math.random() * 70
        ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`
        ctx.lineWidth = 1 + Math.random()
        ctx.beginPath()
        ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    },
    false,
  )
}

/** straight brushing for flat parts */
function linearBrush() {
  return canvas(
    512,
    (ctx, s) => {
      ctx.fillStyle = 'rgb(120,120,120)'
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < s; y += 1) {
        const v = 90 + Math.random() * 80
        ctx.fillStyle = `rgba(${v},${v},${v},0.5)`
        ctx.fillRect(0, y, s, 1)
      }
    },
    false,
  )
}

/**
 * Riveted steel wall panels with the relief painted in: each seam is a dark groove with a lit edge
 * beside it, each rivet a domed highlight over a soft shadow. No bump map: derivative-based bumps
 * shimmer and make the seams look like they swim whenever the camera moves.
 */
function wallPanels() {
  return canvas(2048, (ctx, s) => {
    const cols = 4
    const rows = 3
    const pw = s / cols
    const ph = s / rows
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const tone = 166 + Math.floor(Math.random() * 20)
        const g = ctx.createLinearGradient(i * pw, j * ph, (i + 1) * pw, (j + 1) * ph)
        g.addColorStop(0, `rgb(${tone + 10},${tone + 12},${tone + 16})`)
        g.addColorStop(1, `rgb(${tone - 12},${tone - 10},${tone - 6})`)
        ctx.fillStyle = g
        ctx.fillRect(i * pw, j * ph, pw, ph)
      }
    }
    // seams: soft groove plus a highlight on the lower/right lip
    for (let i = 0; i <= cols; i++) {
      const x = i * pw
      const groove = ctx.createLinearGradient(x - 7, 0, x + 7, 0)
      groove.addColorStop(0, 'rgba(40,43,48,0)')
      groove.addColorStop(0.45, 'rgba(40,43,48,0.95)')
      groove.addColorStop(0.62, 'rgba(255,255,255,0.55)')
      groove.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = groove
      ctx.fillRect(x - 7, 0, 14, s)
    }
    for (let j = 0; j <= rows; j++) {
      const y = j * ph
      const groove = ctx.createLinearGradient(0, y - 7, 0, y + 7)
      groove.addColorStop(0, 'rgba(40,43,48,0)')
      groove.addColorStop(0.45, 'rgba(40,43,48,0.95)')
      groove.addColorStop(0.62, 'rgba(255,255,255,0.55)')
      groove.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = groove
      ctx.fillRect(0, y - 7, s, 14)
    }
    // rivets along every panel border: shadow, dome, specular dot
    const rivet = (x: number, y: number) => {
      ctx.fillStyle = 'rgba(30,32,36,0.45)'
      ctx.beginPath()
      ctx.arc(x + 2.5, y + 3, 10, 0, Math.PI * 2)
      ctx.fill()
      const dome = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10)
      dome.addColorStop(0, 'rgb(250,251,253)')
      dome.addColorStop(0.5, 'rgb(196,200,207)')
      dome.addColorStop(1, 'rgb(118,122,130)')
      ctx.fillStyle = dome
      ctx.beginPath()
      ctx.arc(x, y, 10, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        for (let k = 1; k < 8; k++) {
          rivet(i * pw + 28, j * ph + (k * ph) / 8)
          rivet(i * pw + (k * pw) / 8, j * ph + 28)
        }
      }
    }
  })
}

/** large polished floor tiles */
function floorTiles() {
  return canvas(1024, (ctx, s) => {
    const n = 4
    const t = s / n
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 96 + Math.floor(Math.random() * 18)
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`
        ctx.fillRect(i * t, j * t, t, t)
        // faint marble veins
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(i * t, j * t + Math.random() * t)
        for (let k = 0; k < 5; k++) ctx.lineTo(i * t + ((k + 1) * t) / 5, j * t + Math.random() * t)
        ctx.stroke()
      }
    }
    ctx.fillStyle = 'rgb(22,23,26)'
    for (let i = 0; i <= n; i++) {
      ctx.fillRect(i * t - 2, 0, 4, s)
      ctx.fillRect(0, i * t - 2, s, 4)
    }
  })
}

// ---------------------------------------------------------------- materials

let cache: ReturnType<typeof create> | null = null

function create() {
  const brass = LOOK === 'brass'
  const circular = circularBrush()
  const linear = linearBrush()
  const panels = wallPanels()
  const tiles = floorTiles()
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping
  tiles.repeat.set(10, 10)
  panels.wrapS = panels.wrapT = THREE.RepeatWrapping
  panels.anisotropy = 16
  // wall and interior UVs are in world units: one riveted sheet of 4 x 3 panels covers 16 x 12 units
  panels.repeat.set(1 / 16, 1 / 12)
  linear.wrapS = linear.wrapT = THREE.RepeatWrapping

  const metal = (color: string, roughness: number, roughnessMap?: THREE.Texture, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness, roughnessMap, envMapIntensity: 1.25, ...extra })

  return {
    look: LOOK,
    /** the door's main faces: machined steel or bronze */
    face: metal(brass ? '#c99a55' : '#c9ced6', 0.42, circular),
    /** flat structural metal: frame, hinge, bezel */
    body: metal(brass ? '#b38441' : '#b7bcc5', 0.38, linear),
    /** recessed bands and the door's inner side */
    dark: metal(brass ? '#5e4524' : '#5a5f68', 0.5, linear),
    chrome: metal('#eef1f5', 0.12, undefined, { clearcoat: 0.3 }),
    /** rivets and bolt heads: brass on the silver door, bright bronze on the brass one */
    accent: metal(brass ? '#e0b46a' : '#c8924a', 0.3),
    gold: new THREE.MeshPhysicalMaterial({ color: '#ffc845', emissive: '#6a3f00', emissiveIntensity: 0.35, metalness: 1, roughness: 0.24, envMapIntensity: 1.6 }),
    wall: new THREE.MeshStandardMaterial({ map: panels, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.8 }),
    wallInside: new THREE.MeshStandardMaterial({ map: panels, color: '#8a7a62', metalness: 0.6, roughness: 0.5, envMapIntensity: 0.6 }),
    floor: tiles,
  }
}

export function vaultMaterials() {
  return (cache ??= create())
}
