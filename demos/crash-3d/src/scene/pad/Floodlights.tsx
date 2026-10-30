import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CustomBlending,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OneFactor,
  Quaternion,
  ShaderMaterial,
  SpotLight,
  Vector3,
  type BufferGeometry,
  type Group,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { envLit } from '../env/envSync'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { floodPos, FLOODS, GROUND_Y, HIDE_ALT_M, type FloodSpec } from './layout'
import { notReflected } from './reflection'

// the floodlights: spot lights with shadows from the rocket and the tower, the masts and lamp banks they hang on,
// searchlights on the ground, and a visible beam for each (an additive cone: bright on its axis, soft at the rim,
// stirred by drifting haze). the lights stay in the scene while the pad is hidden, at intensity 0: adding or removing
// a light recompiles every lit material

export const ACTIVE_FLOODS: FloodSpec[] = FLOODS.slice(0, QUALITY.floodlights)

const UP = new Vector3(0, 1, 0)
const LAMP_R = 0.48
const LAMP_I = 12 // hdr lamp face brightness
const LAMP_GRID: [number, number] = [4, 3]
const LAMP_PITCH = 1.25
const BEAM_GAIN = 0.07
const SHADOW_ALT_M = 2500

const beamVertex = /* glsl */ `
uniform float uLen;
varying vec3 vW;
varying vec3 vN;
varying float vAx;
void main() {
  vAx = position.y / uLen;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uLen;
uniform float uTime;
uniform float uGround;
varying vec3 vW;
varying vec3 vN;
varying float vAx;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

void main() {
  vec3 v = normalize(cameraPosition - vW);
  // a view ray through the middle of the cone crosses more lit air than one grazing its rim: front and back faces
  // both add, so the sum follows the chord through the cone
  float facing = abs(dot(normalize(vN), v));
  float body = facing * sqrt(facing);
  float d = vAx * uLen;
  float near = uLen * 0.2;
  float fall = 1.0 / (1.0 + d * d / (near * near));
  float ends = smoothstep(0.0, 0.025, vAx) * (1.0 - smoothstep(0.5, 1.0, vAx));
  // haze drifting through the light
  vec3 q = vW * 0.06 + vec3(uTime * 0.05, -uTime * 0.11, uTime * 0.04);
  float n = noise(q) * 0.62 + noise(q * 2.9 + 7.3) * 0.38;
  float haze = 0.35 + 1.1 * n * n;
  float ground = smoothstep(0.0, 5.0, vW.y - uGround);
  gl_FragColor = vec4(uColor * (body * fall * ends * haze * ground), 1.0);
}
`

interface Built {
  hardwareMaterial: MeshStandardMaterial
  lights: SpotLight[]
  beams: Mesh<BufferGeometry, ShaderMaterial>[]
  hardware: Mesh
  lamps: InstancedMesh
  dispose(): void
}

// a transform whose +z looks from `at` towards `to`
function facing(at: Vector3, to: Vector3): Matrix4 {
  const m = new Matrix4().lookAt(to, at, UP)
  return m.setPosition(at)
}

function build(): Built {
  let shadows = QUALITY.floodShadows
  const parts: BufferGeometry[] = []
  const lampMats: Matrix4[] = []
  const lights: SpotLight[] = []
  const beams: Mesh<BufferGeometry, ShaderMaterial>[] = []
  const hw = new MeshStandardMaterial({ color: new Color(0.16, 0.165, 0.17), roughness: 0.6, metalness: 0.4, envMapIntensity: 0.3 })

  for (const f of ACTIVE_FLOODS) {
    const head = floodPos(f)
    const aim = new Vector3(...f.aim)
    const dir = new Vector3().subVectors(aim, head).normalize()
    const frame = facing(head, aim)

    const light = new SpotLight(new Color(...f.color), f.cd, 0, f.angle, f.penumbra, 2)
    light.position.copy(head)
    light.target.position.copy(aim)
    if (f.mast && shadows > 0) {
      shadows--
      light.castShadow = true
      light.shadow.mapSize.set(QUALITY.floodShadowMap, QUALITY.floodShadowMap)
      light.shadow.camera.near = 30
      light.shadow.camera.far = 260
      light.shadow.bias = -0.0002
      light.shadow.normalBias = 0.06
      light.shadow.radius = 2.5
    }
    lights.push(light)

    if (f.mast) {
      const poleH = head.y - 2.2 - GROUND_Y
      parts.push(new CylinderGeometry(0.32, 0.6, poleH, 10).translate(head.x, GROUND_Y + poleH / 2, head.z))
      parts.push(new BoxGeometry(5.2, 0.22, 3.2).translate(head.x, head.y - 2.2, head.z))
      parts.push(new BoxGeometry(LAMP_GRID[0] * LAMP_PITCH + 0.5, LAMP_GRID[1] * LAMP_PITCH + 0.5, 0.7).applyMatrix4(frame))
      for (let i = 0; i < LAMP_GRID[0]; i++) {
        for (let j = 0; j < LAMP_GRID[1]; j++) {
          const lx = (i - (LAMP_GRID[0] - 1) / 2) * LAMP_PITCH
          const ly = (j - (LAMP_GRID[1] - 1) / 2) * LAMP_PITCH
          lampMats.push(frame.clone().multiply(new Matrix4().makeTranslation(lx, ly, 0.37)))
        }
      }
    } else {
      // searchlight: a drum on a low stand, its lens towards the sky
      parts.push(new BoxGeometry(1.6, 0.7, 1.6).translate(head.x, GROUND_Y + 0.35, head.z))
      const q = new Quaternion().setFromUnitVectors(UP, dir)
      parts.push(new CylinderGeometry(0.8, 0.8, 1.9, 20).applyQuaternion(q).translate(head.x, head.y, head.z))
      lampMats.push(frame.clone().multiply(new Matrix4().makeTranslation(0, 0, 0.96)).scale(new Vector3(1.5, 1.5, 1)))
    }

    // the visible beam starts as wide as the lamp bank and opens with the cone
    const r0 = f.mast ? 2.2 : 0.75
    const r1 = r0 + Math.tan(f.angle * (f.mast ? 0.7 : 0.5)) * f.beam
    const geo = new CylinderGeometry(r1, r0, f.beam, QUALITY.beamSegments, 1, true).translate(0, f.beam / 2, 0)
    const mat = new ShaderMaterial({
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      uniforms: {
        uColor: { value: new Color(...f.color).multiplyScalar(BEAM_GAIN * f.glow) },
        uLen: { value: f.beam },
        uTime: { value: 0 },
        uGround: { value: GROUND_Y },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    })
    const beam = new Mesh(geo, mat)
    beam.position.copy(head)
    beam.quaternion.setFromUnitVectors(UP, dir)
    beam.renderOrder = -2 // before the smoke, which may hide it
    beam.frustumCulled = false
    beams.push(beam)
  }

  const merged = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  const hardware = new Mesh(merged, hw)
  const lampGeo = new CircleGeometry(LAMP_R, 20)
  const lampMat = new MeshBasicMaterial({ color: new Color(0.9, 0.95, 1).multiplyScalar(LAMP_I) })
  const lamps = new InstancedMesh(lampGeo, lampMat, lampMats.length)
  lampMats.forEach((m, i) => lamps.setMatrixAt(i, m))
  lamps.computeBoundingSphere()

  return {
    hardwareMaterial: hw,
    lights,
    beams,
    hardware,
    lamps,
    dispose() {
      merged.dispose()
      hw.dispose()
      lampGeo.dispose()
      lampMat.dispose()
      for (const b of beams) {
        b.geometry.dispose()
        b.material.dispose()
      }
      for (const l of lights) l.dispose()
    },
  }
}

export function Floodlights() {
  const built = useMemo(build, [])
  const visual = useRef<Group>(null)

  // a beam mirrored in a puddle would hang upside down under the ground
  useLayoutEffect(() => {
    for (const b of built.beams) notReflected.add(b)
    return () => {
      for (const b of built.beams) notReflected.delete(b)
    }
  }, [built])
  useEffect(() => {
    envLit.add(built.hardwareMaterial)
    return () => {
      envLit.delete(built.hardwareMaterial)
      built.dispose()
    }
  }, [built])

  useFrame(() => {
    const on = rig.altM <= HIDE_ALT_M
    if (visual.current) visual.current.visible = on
    // the rocket is long gone: keep the lights (no recompile) but stop their shadow passes
    const near = rig.altM < SHADOW_ALT_M
    ACTIVE_FLOODS.forEach((f, i) => {
      const l = built.lights[i]
      l.intensity = on ? f.cd : 0
      if (!l.castShadow) return
      l.shadow.autoUpdate = near
      // a page opened high up still needs each map drawn once: the shaders sample them either way
      if (!near && !l.shadow.map) l.shadow.needsUpdate = true
    })
    const ground = GROUND_Y - rig.nearOffset
    for (const b of built.beams) {
      b.material.uniforms.uTime.value = rig.vtime
      b.material.uniforms.uGround.value = ground
    }
  })

  return (
    <>
      {built.lights.map((l, i) => (
        <group key={i}>
          <primitive object={l} />
          <primitive object={l.target} />
        </group>
      ))}
      <group ref={visual} name="floodlights">
        <primitive object={built.hardware} />
        <primitive object={built.lamps} />
        {built.beams.map((b, i) => (
          <primitive key={i} object={b} />
        ))}
      </group>
    </>
  )
}
