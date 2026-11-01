import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, RingGeometry, ShaderMaterial, Vector2, Vector3, type PerspectiveCamera } from 'three'
import { fx, type DistortionSource } from '../fx'
import { FX_NEAR_LAYER } from '../layers'
import { rig } from '../rig'
import { additiveLight, type Blast } from './blast'
import { crashTimeline } from './timeline'

const RING_REFRACT = 0.035 // uv offset in screen heights at full strength

// the shockwave: a refracting screen-space ring (post/DistortionEffect) and a thin glowing shell, both racing out
export function Shockwave({ blast }: { blast: { current: Blast } }) {
  const ring = useMemo<DistortionSource>(() => ({ pos: new Vector2(), radius: 0, strength: 0, ring: true }), [])
  const geo = useMemo(() => new RingGeometry(0.9, 1, 128, 1), [])
  const mat = useMemo(() => {
    const m = new ShaderMaterial({
      uniforms: { uLevel: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vR;
        void main() {
          vR = length(position.xy);
          // a billboard: the ring always faces the camera
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += position.xy * length(modelMatrix[0].xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLevel;
        varying float vR;
        void main() {
          // 0 at both edges of the band (radius 0.9 and 1), 1 in its middle
          float band = 1.0 - abs((vR - 0.95) * 20.0);
          gl_FragColor = vec4(vec3(1.4, 1.5, 1.7) * band * band * uLevel, 0.0);
        }`,
    })
    additiveLight(m)
    return m
  }, [])
  const mesh = useRef<Mesh>(null)
  const center = useMemo(() => new Vector3(), [])

  useEffect(() => {
    fx.distortion.push(ring)
    return () => {
      const i = fx.distortion.indexOf(ring)
      if (i >= 0) fx.distortion.splice(i, 1)
      geo.dispose()
      mat.dispose()
    }
  }, [ring, geo, mat])

  useFrame(({ camera }) => {
    const b = blast.current
    ring.strength = 0
    if (!b.active || !mesh.current) return
    const beat = crashTimeline(rig.vtime - b.vtime0, b.short)
    mesh.current.scale.setScalar(Math.max(0.01, beat.ringRadius))
    mat.uniforms.uLevel.value = beat.ringStrength * 0.25
    mesh.current.getWorldPosition(center)
    const dist = center.distanceTo(camera.position)
    center.project(camera)
    if (center.z >= 1 || !('fov' in camera)) return
    ring.pos.set(center.x * 0.5 + 0.5, center.y * 0.5 + 0.5)
    const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 180
    ring.radius = Math.min(2, beat.ringRadius / (2 * Math.max(1, dist) * Math.tan(fov / 2)))
    ring.strength = RING_REFRACT * beat.ringStrength
  })

  return (
    <mesh
      ref={(m) => {
        mesh.current = m
        m?.layers.enable(FX_NEAR_LAYER)
      }}
      geometry={geo}
      material={mat}
      frustumCulled={false}
      renderOrder={3}
    />
  )
}
