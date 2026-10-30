// Shared physical materials of the casino lounge (values from the Clickable landings).
// One instance each: every cabinet, chip and rim reuses them.
import { brandColors } from '@brand/tokens'
import * as THREE from 'three'

// MeshStandardMaterial with low roughness instead of MeshPhysicalMaterial + clearcoat: nearly the same
// gloss on screen, a much cheaper fragment shader (the physical set held only ~45 FPS on an iGPU).
const cache = new Map<string, THREE.MeshStandardMaterial>()
function shared(key: string, make: () => THREE.MeshStandardMaterial) {
  let m = cache.get(key)
  if (!m) cache.set(key, (m = make()))
  return m
}

/** Polished chrome: needs the studio environment to read as metal. */
export const chrome = () => shared('chrome', () => new THREE.MeshStandardMaterial({ color: '#f2f3f5', metalness: 1, roughness: 0.14, envMapIntensity: 1.8 }))

/** White glossy enamel, the cabinet crown. */
export const whiteChrome = () => shared('white', () => new THREE.MeshStandardMaterial({ color: '#e6e7ec', roughness: 0.18, envMapIntensity: 0.85 }))

/** Glossy red ceramic, the cabinet body and red chips. */
export const ceramicRed = () => shared('ceramic', () => new THREE.MeshStandardMaterial({ color: '#e0101a', roughness: 0.16, envMapIntensity: 1 }))

/** Dark lacquer, screen bezels and black chips. */
export const lacquerDark = () => shared('lacquer', () => new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.22, metalness: 0.4 }))

const WARM = new THREE.Color('#fff1e0')
const RED = new THREE.Color(brandColors.red)

/** Crown lamp: warm white on the active cabinet, a dim red ember on the others, bright red while refusing. */
export function lampColor(active: boolean, flash: number): THREE.Color {
  const base = active ? WARM.clone().multiplyScalar(1.6) : RED.clone().multiplyScalar(0.6)
  return flash > 0 ? base.lerp(RED.clone().multiplyScalar(3), Math.min(1, flash)) : base
}

/** The glowing mark inside the glass core: luminance ~1.5, above the bloom ramp (1.1 + 0.3) at any pulse. */
export const CORE_GLOW = new THREE.Color('#ff4a52').multiplyScalar(5.6)
