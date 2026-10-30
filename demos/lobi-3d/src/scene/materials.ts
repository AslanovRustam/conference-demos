// Shared physical materials of the casino lounge (values from the Clickable landings).
// One instance each: every cabinet, chip and rim reuses them.
import { brandColors } from '@brand/tokens'
import * as THREE from 'three'

const cache = new Map<string, THREE.MeshPhysicalMaterial>()
function shared(key: string, make: () => THREE.MeshPhysicalMaterial) {
  let m = cache.get(key)
  if (!m) cache.set(key, (m = make()))
  return m
}

/** Polished chrome: needs the studio environment to read as metal. */
export const chrome = () =>
  shared('chrome', () => new THREE.MeshPhysicalMaterial({ color: '#f2f3f5', metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.8 }))

/** White glossy enamel, the cabinet crown. */
export const whiteChrome = () => shared('white', () => new THREE.MeshPhysicalMaterial({ color: '#e6e7ec', roughness: 0.26, clearcoat: 1, envMapIntensity: 0.85 }))

/** Glossy red ceramic, the cabinet body and red chips. */
export const ceramicRed = () =>
  shared('ceramic', () => new THREE.MeshPhysicalMaterial({ color: '#e0101a', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1 }))

/** Dark lacquer, screen bezels and black chips. */
export const lacquerDark = () =>
  shared('lacquer', () => new THREE.MeshPhysicalMaterial({ color: '#15161c', roughness: 0.3, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 }))

const WARM = new THREE.Color('#fff1e0')
const RED = new THREE.Color(brandColors.red)

/** Crown lamp: warm white on the active cabinet, a dim red ember on the others, bright red while refusing. */
export function lampColor(active: boolean, flash: number): THREE.Color {
  const base = active ? WARM.clone().multiplyScalar(1.6) : RED.clone().multiplyScalar(0.6)
  return flash > 0 ? base.lerp(RED.clone().multiplyScalar(3), Math.min(1, flash)) : base
}
