// Sparse red sparks rising slowly through the hall, as on the Noir landing.
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { params } from '../state/params'

const COUNT = params.quality === 'low' ? 80 : 220
const SPREAD = 16
const HEIGHT = 6
const RISE = 0.18 // m/s

export default function Sparks() {
  const { points, positions } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 1] = Math.random() * HEIGHT
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: '#ff6a70', size: 0.045, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })
    return { points: new THREE.Points(geo, mat), positions }
  }, [])

  useFrame((_, dt) => {
    for (let i = 0; i < COUNT; i++) {
      const y = positions[i * 3 + 1] + dt * RISE * (0.6 + (i % 5) * 0.12)
      positions[i * 3 + 1] = y > HEIGHT ? 0 : y
    }
    points.geometry.attributes.position.needsUpdate = true
  })

  return <primitive object={points} />
}
