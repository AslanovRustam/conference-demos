// The lounge around the stage: a curved wall of ribbed panels lit from below by wall washers, the
// washers' glow on the glossy floor, and out-of-focus lights hanging in the haze between the wall
// and the stage. All unlit shaders: the wall fills most of the frame, so live lights would cost
// more than the rest of the scene.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { params } from '../state/params'
import { portraitBlend } from './cameraMath'

/** wall around the hall, in metres; the camera and the attract orbit stay well inside it */
export const WALL = { radius: 17, height: 13, panels: 32 } as const

const WARM = new THREE.Color('#ff7a4d')
const RED = new THREE.Color('#e5141f')

// the panel/washer pattern, shared by the wall and its reflection on the floor:
// f = position across the panel in metres (0 = under the washer), w = panel width in metres
const PANEL_GLSL = /* glsl */ `
  uniform float uRadius;
  uniform float uPanels;
  const float TAU = 6.28318530718;
  vec2 panelAt(vec3 p) {
    float a = atan(p.x, p.z) / TAU * uPanels;
    float w = TAU * uRadius / uPanels;
    return vec2((fract(a) - 0.5) * w, w);
  }
  // ±half a code value of noise: dark gradients band visibly on 8-bit screens without it
  float dither(vec2 frag) {
    return (fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  }
`

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const WALL_FRAGMENT = /* glsl */ `
  ${PANEL_GLSL}
  uniform float uHeight;
  uniform vec3 uWarm;
  uniform vec3 uRed;
  varying vec3 vWorld;
  void main() {
    vec2 pw = panelAt(vWorld);
    float x = pw.x;
    float y = max(vWorld.y, 0.0);
    // vertical ribs catch the light on their crowns
    float rib = pow(0.5 + 0.5 * cos(TAU * x / 0.42), 0.6);
    float relief = mix(0.6, 1.0, rib);
    // dark seam between panels
    float seam = smoothstep(0.03, 0.09, pw.y * 0.5 - abs(x));
    // wall washer at the foot of each panel: a cone of light widening and fading upward
    float spread = 0.18 + y * 0.2;
    float washer = exp(-x * x / (spread * spread)) * exp(-y / 1.9) * smoothstep(0.0, 0.4, y);
    // hot spot right above the fixture
    float hot = exp(-x * x / 0.012) * exp(-y / 0.3);
    // red glow pooling along the foot of the wall
    float foot = exp(-y / 0.9);
    vec3 col = uWarm * (washer * 0.2 + hot * 0.5) + uRed * foot * 0.06;
    col *= relief * seam;
    // the upper wall disappears into the dark
    col *= 1.0 - smoothstep(1.0, uHeight * 0.5, y);
    gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
  }
`

const FLOOR_FRAGMENT = /* glsl */ `
  ${PANEL_GLSL}
  uniform vec3 uWarm;
  uniform vec3 uRed;
  varying vec3 vWorld;
  void main() {
    vec2 pw = panelAt(vWorld);
    float x = pw.x;
    float d = uRadius - length(vWorld.xz);
    // each washer's reflection streaks across the gloss toward the stage
    float streak = exp(-x * x / pow(0.25 + d * 0.12, 2.0)) * exp(-d / 1.6);
    float pool = exp(-d / 0.9);
    vec3 col = uWarm * streak * 0.1 + uRed * pool * 0.05;
    gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
  }
`

function Wall() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: WALL_FRAGMENT,
        side: THREE.BackSide,
        uniforms: {
          uRadius: { value: WALL.radius },
          uPanels: { value: WALL.panels },
          uHeight: { value: WALL.height },
          uWarm: { value: WARM },
          uRed: { value: RED },
        },
      }),
    [],
  )
  return (
    <mesh position-y={WALL.height / 2} material={material}>
      <cylinderGeometry args={[WALL.radius, WALL.radius, WALL.height, 256, 1, true]} />
    </mesh>
  )
}

function FloorGlow() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FLOOR_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        // lies on the floor: pulled toward the camera so it never fights the floor for depth
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: {
          uRadius: { value: WALL.radius },
          uPanels: { value: WALL.panels },
          uWarm: { value: WARM },
          uRed: { value: RED },
        },
      }),
    [],
  )
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.005} material={material}>
      <ringGeometry args={[WALL.radius - 8, WALL.radius, 256, 1]} />
    </mesh>
  )
}

// out-of-focus lights in the haze: soft discs with the faint bright rim of a real lens bokeh
const BOKEH_COUNT = params.quality === 'low' ? 18 : 36
const BOKEH_PALETTE = ['#ff4a3d', '#ff2a2a', '#ff7a5c', '#ffe2cc'].map((c) => new THREE.Color(c))

const BOKEH_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.07 + aPhase * 6.0) * 0.35;
    p.y += sin(uTime * 0.11 + aPhase * 9.0) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vColor = aColor;
    vAlpha = 0.6 + 0.4 * sin(uTime * (0.35 + aPhase * 0.4) + aPhase * 40.0);
  }
`

const BOKEH_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    if (r > 1.0) discard;
    float disc = smoothstep(1.0, 0.86, r);
    float rim = smoothstep(0.62, 0.92, r) * disc;
    gl_FragColor = vec4(vColor, (disc * 0.55 + rim * 0.45) * vAlpha * 0.13);
  }
`

function Bokeh() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const points = useMemo(() => {
    const pos = new Float32Array(BOKEH_COUNT * 3)
    const size = new Float32Array(BOKEH_COUNT)
    const phase = new Float32Array(BOKEH_COUNT)
    const color = new Float32Array(BOKEH_COUNT * 3)
    for (let i = 0; i < BOKEH_COUNT; i++) {
      // a band behind the stage, as far out as the wall: never between the stage and the camera
      const a = Math.PI + (Math.random() * 2 - 1) * 1.45
      const r = 8 + Math.random() * 7.5
      pos.set([Math.sin(a) * r, 0.6 + Math.random() * 7.5, Math.cos(a) * r], i * 3)
      size[i] = 0.25 + Math.random() ** 2 * 0.6
      phase[i] = Math.random()
      BOKEH_PALETTE[Math.floor(Math.random() * BOKEH_PALETTE.length)].toArray(color, i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader: BOKEH_VERTEX,
      fragmentShader: BOKEH_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    })
    return new THREE.Points(geo, mat)
  }, [])

  const buffer = useMemo(() => new THREE.Vector2(), [])
  useFrame(({ clock }) => {
    const u = (points.material as THREE.ShaderMaterial).uniforms
    u.uTime.value = clock.elapsedTime
    // world size → pixels at unit distance, so the discs keep their size at any resolution and DPR
    u.uScale.value = gl.getDrawingBufferSize(buffer).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
  })

  return <primitive object={points} />
}

// stage light falling through the haze from the dark above the hall: open cones, brightest where
// the view grazes their middle, fading out at both ends so neither the source nor the floor shows
// a hard edge, plus the soft pool each one leaves on the floor. `upright` beams fade in only on a
// phone held upright, whose narrow frame misses the outer ones
const SHAFTS: { top: [number, number, number]; foot: [number, number, number]; width: number; upright?: boolean }[] = [
  { top: [-3.5, 10.5, -10], foot: [-7, 0, -8.5], width: 1.9 },
  { top: [3.5, 10.5, -10], foot: [7, 0, -8.5], width: 1.9 },
  { top: [-9, 10.5, -8], foot: [-12.5, 0, -4.5], width: 2.3 },
  { top: [9, 10.5, -8], foot: [12.5, 0, -4.5], width: 2.3 },
  { top: [-1.2, 11, -11], foot: [-3.6, 0, -10], width: 1.5, upright: true },
  { top: [1.2, 11, -11], foot: [3.6, 0, -10], width: 1.5, upright: true },
]

const SHAFT_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAlong;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    vAlong = uv.y;
    gl_Position = projectionMatrix * mv;
  }
`

const SHAFT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAlong;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float core = pow(facing, 3.0);
    float ends = smoothstep(0.0, 0.5, vAlong) * smoothstep(1.0, 0.9, vAlong);
    gl_FragColor = vec4(uColor, core * ends * uStrength);
  }
`

const POOL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    gl_FragColor = vec4(uColor, exp(-r * r * 4.0) * uStrength);
  }
`

const SHAFT_STRENGTH = 0.1
const POOL_STRENGTH = 0.16

function LightShafts() {
  const aspect = useThree((s) => s.size.width / s.size.height)
  const { beams, uprightMaterials } = useMemo(() => {
    const color = new THREE.Color('#ffd9c2')
    const shaft = (strength: number) =>
      new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERTEX,
        fragmentShader: SHAFT_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: color }, uStrength: { value: strength } },
      })
    const pool = (strength: number) =>
      new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: POOL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: { uColor: { value: color }, uStrength: { value: strength } },
      })
    const material = shaft(SHAFT_STRENGTH)
    const poolMaterial = pool(POOL_STRENGTH)
    const uprightMaterials = { shaft: shaft(0), pool: pool(0) }
    const beams = SHAFTS.map(({ top, foot, width, upright }) => {
      const a = new THREE.Vector3(...top)
      const b = new THREE.Vector3(...foot)
      const length = a.distanceTo(b)
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, width, length, 48, 1, true), upright ? uprightMaterials.shaft : material)
      // the cylinder runs along +y: point it from the foot up to the top
      mesh.position.copy(a).add(b).multiplyScalar(0.5)
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.sub(b).normalize())
      return { mesh, foot, width, pool: upright ? uprightMaterials.pool : poolMaterial }
    })
    return { beams, uprightMaterials }
  }, [])
  useEffect(() => {
    const p = portraitBlend(aspect)
    uprightMaterials.shaft.uniforms.uStrength.value = SHAFT_STRENGTH * p
    uprightMaterials.pool.uniforms.uStrength.value = POOL_STRENGTH * p
  }, [aspect, uprightMaterials])
  return (
    <group>
      {beams.map(({ mesh, foot, width, pool }, i) => (
        <group key={i}>
          <primitive object={mesh} />
          <mesh position={[foot[0], 0.006, foot[2]]} rotation-x={-Math.PI / 2} material={pool}>
            <planeGeometry args={[width * 2.6, width * 2.6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function Backdrop() {
  return (
    <group>
      <Wall />
      <FloorGlow />
      {params.quality === 'high' && <LightShafts />}
      <Bokeh />
    </group>
  )
}
