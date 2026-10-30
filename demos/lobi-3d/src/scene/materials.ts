// Shared physical materials of the casino lounge (values from the Clickable landings).
import * as THREE from 'three'

let chromeMat: THREE.MeshPhysicalMaterial | null = null

/** Polished chrome: needs the studio environment to read as metal. */
export function chrome(): THREE.MeshPhysicalMaterial {
  chromeMat ??= new THREE.MeshPhysicalMaterial({ color: '#f2f3f5', metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.8 })
  return chromeMat
}
