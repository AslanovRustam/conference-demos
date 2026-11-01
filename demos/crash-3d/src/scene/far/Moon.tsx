import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AddEquation, CustomBlending, Mesh, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3, ZeroFactor, type Texture } from 'three'
import { shotFrame } from '../camera/shotFrame'
import { lightState } from '../env/lightState'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { FAR_SKY_R } from './FarField'

const DIST = FAR_SKY_R * 0.8
const DEG = Math.PI / 180
const SIZE_NEAR = 1.4 * DEG // apparent radius from orbit: larger than life for the broadcast frame
const SIZE_FAR = 2.4 * DEG // and closer still from deep space
const FADE = [2.8, 3.3] as const
// staged for each shot: up and to the right of where the camera looks when the shot begins
const UP = 0.28
const RIGHT = 0.55
const moonDir = new Vector3()

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// the moon in the far field: the lro colour mosaic lit by the sun, with a faint earthshine on the dark side
export function Moon() {
  const tex = useTexture(import.meta.env.BASE_URL + QUALITY.moonTexture) as Texture
  const geo = useMemo(() => new SphereGeometry(1, 96, 48), [])
  const mat = useMemo(() => {
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    const m = new ShaderMaterial({
      uniforms: { uMap: { value: tex }, uSun: { value: new Vector3() }, uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vN;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uSun;
        uniform float uAlpha;
        varying vec2 vUv;
        varying vec3 vN;
        void main() {
          vec3 albedo = texture2D(uMap, vUv).rgb;
          float ndl = dot(normalize(vN), uSun);
          vec3 col = albedo * (max(ndl, 0.0) * 2.6 + 0.025);
          gl_FragColor = vec4(col * uAlpha, uAlpha);
        }`,
    })
    // far field: opaque list, no depth, blended in with the alpha uniform
    m.depthTest = false
    m.depthWrite = false
    m.blending = CustomBlending
    m.blendEquation = AddEquation
    m.blendSrc = OneFactor
    m.blendDst = OneMinusSrcAlphaFactor
    m.blendSrcAlpha = ZeroFactor
    m.blendDstAlpha = OneFactor
    return m
  }, [tex])
  const mesh = useRef<Mesh>(null)

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const a = clamp01((rig.stageF - FADE[0]) / (FADE[1] - FADE[0]))
    m.visible = a > 0.001
    if (!m.visible) return
    mat.uniforms.uAlpha.value = a
    ;(mat.uniforms.uSun.value as Vector3).copy(lightState.sunDir)
    const size = SIZE_NEAR + (SIZE_FAR - SIZE_NEAR) * clamp01(rig.stageF - 4)
    const f = shotFrame.forward
    moonDir.set(f.x - RIGHT * f.z, UP, f.z + RIGHT * f.x).normalize()
    m.position.copy(moonDir).multiplyScalar(DIST)
    m.scale.setScalar(DIST * Math.tan(size))
  })

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={-70} visible={false} />
}
