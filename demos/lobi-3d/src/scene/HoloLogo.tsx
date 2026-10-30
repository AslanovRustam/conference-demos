import logoSvg from '@brand/logo/clickable-logo-red.svg?raw'
import { brandColors } from '@brand/tokens'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { LOGO } from './layout'

function logoGeometry(): THREE.BufferGeometry {
  const shapes = new SVGLoader().parse(logoSvg).paths.flatMap((p) => p.toShapes())
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 5, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.5, bevelSegments: 2, curveSegments: 10 })
  geo.computeBoundingBox()
  const box = geo.boundingBox!
  const width = box.max.x - box.min.x
  geo.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2)
  // SVG y points down; flip it and scale the wordmark to its width in metres
  const s = LOGO.width / width
  geo.scale(s, -s, s)
  return geo
}

// hologram look: scanlines drifting up, a faint flicker, brighter rims where the surface turns away
const holoVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const holoFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - abs(dot(normalize(vNormalW), view)), 2.0);
    float scan = 0.8 + 0.2 * sin(vWorld.y * 120.0 - uTime * 5.0);
    float flicker = 0.94 + 0.06 * sin(uTime * 37.0) * sin(uTime * 11.0);
    vec3 col = uColor * (1.7 * scan * flicker + rim * 1.4);
    gl_FragColor = vec4(col, 0.95);
  }
`

export default function HoloLogo() {
  const ref = useRef<THREE.Group>(null)
  const geometry = useMemo(logoGeometry, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: holoVertex,
        fragmentShader: holoFragment,
        uniforms: { uColor: { value: new THREE.Color(brandColors.red) }, uTime: { value: 0 } },
        toneMapped: false,
        transparent: true,
      }),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    material.uniforms.uTime.value = t
    if (!ref.current) return
    // a sway rather than a full turn keeps the wordmark readable from the front
    ref.current.rotation.y = Math.sin(t * 0.35) * 0.44
    ref.current.position.y = LOGO.y + Math.sin(t * 0.8) * 0.06
  })
  return (
    <group ref={ref} position-y={LOGO.y}>
      <mesh geometry={geometry} material={material} />
    </group>
  )
}
