import { useFrame, useThree } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  MeshStandardMaterial,
  type Object3D,
  PointLight,
  Points,
  ShaderMaterial,
  Vector2,
  type Group,
  type PerspectiveCamera,
} from 'three'
import { createRng } from '../../core/rng'
import { envLit } from '../env/envSync'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { flicker } from '../rocket/plumeShader'
import { groundReach } from './emission'
import { Floodlights } from './Floodlights'
import { GROUND_Y, HARDSTAND_R, HIDE_ALT_M, TRENCH_FLOOR_Y } from './layout'
import { concreteGeometry, groundGeometry, hardstandGeometry, steelGeometry, tableGeometry, trenchGeometry } from './padGeometry'
import { disposePadTextures, loadPadTextures, type PadSet, type PadTextures } from './padTextures'
import { notReflected, PlanarReflection, wetReflection } from './reflection'
import { Smoke } from './Smoke'
import { Tower } from './Tower'

// the launch pad at night: a wet concrete apron with a flame trench, the launch mount the rocket stands on,
// the service tower, floodlights, steam and exhaust clouds, dark land to the horizon with the lights of the rest
// of the complex. everything sinks by rig.nearOffset and is not drawn past HIDE_ALT_M

const GLOW_CD = 2400 // the exhaust boiling under the mount, at full thrust on the deck
const REFLECT_ALT_M = 3000 // no mirrored pass once the rocket (and the camera with it) is this high
const GLOW_COLOR = new Color(1, 0.46, 0.16)

function pbr(set: PadSet, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ map: set.color, roughnessMap: set.orm, normalMap: set.normal, roughness: 1, metalness: 0 })
  Object.assign(m, extra)
  return m
}

function useMaterials(t: PadTextures, reflection: PlanarReflection) {
  return useMemo(() => {
    // the planar reflection takes over from the environment map on the wet apron (its warm lamp banks at the
    // horizon would glaze the whole apron at grazing angles)
    const hardstand = pbr(t.hardstand, { envMapIntensity: 0, normalScale: new Vector2(0.6, 0.6) })
    if (QUALITY.padReflection.enabled) wetReflection(hardstand, reflection)
    const ground = pbr(t.soil, { vertexColors: true, envMapIntensity: 0 })
    const deck = pbr(t.deck, { color: new Color(0.6, 0.6, 0.6), metalness: 0.35, envMapIntensity: 0.15 })
    const concrete = pbr(t.concrete, { envMapIntensity: 0.12 })
    const trench = pbr(t.concrete, { color: new Color(0.3, 0.28, 0.27), envMapIntensity: 0.1 })
    const steel = new MeshStandardMaterial({ color: new Color(0.24, 0.24, 0.25), roughness: 0.5, metalness: 0.55, envMapIntensity: 0.3 })
    return { hardstand, ground, deck, concrete, trench, steel }
  }, [t, reflection])
}

// pad materials take part in the environment sync (env/envSync.ts) while mounted
function usePadLit(mats: MeshStandardMaterial[]) {
  useLayoutEffect(() => {
    for (const m of mats) envLit.add(m)
    return () => {
      for (const m of mats) envLit.delete(m)
    }
  }, [mats])
}

// registered before the first frame: the apron must never draw into its own reflection
function leaveOut(o: Object3D | null) {
  if (!o) return
  notReflected.add(o)
  return () => {
    notReflected.delete(o)
  }
}

function Ground({ t }: { t: PadTextures }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const reflection = useMemo(() => new PlanarReflection(HARDSTAND_R), [])
  const m = useMaterials(t, reflection)
  usePadLit(useMemo(() => Object.values(m), [m]))
  const geo = useMemo(
    () => ({
      hardstand: hardstandGeometry(),
      ground: groundGeometry(),
      table: tableGeometry(),
      concrete: concreteGeometry(),
      trench: trenchGeometry(),
      steel: steelGeometry(),
    }),
    [],
  )
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose()
      for (const mat of Object.values(m)) mat.dispose()
    },
    [geo, m],
  )
  useEffect(() => () => reflection.dispose(), [reflection])

  // the mirrored pass, while the apron is close enough to matter and in view
  useFrame(({ camera }) => {
    if (!QUALITY.padReflection.enabled) return
    const k = QUALITY.padReflection.scale * dpr
    reflection.setSize(size.width * k, size.height * k)
    if (rig.altM > REFLECT_ALT_M) reflection.off()
    else reflection.render(gl, scene, camera, GROUND_Y - rig.nearOffset)
  })

  return (
    <group name="pad-ground">
      <mesh ref={leaveOut} geometry={geo.hardstand} material={m.hardstand} receiveShadow />
      <mesh ref={leaveOut} geometry={geo.ground} material={m.ground} receiveShadow />
      <mesh geometry={geo.table} material={[m.deck, m.concrete]} castShadow receiveShadow />
      <mesh geometry={geo.concrete} material={m.concrete} castShadow receiveShadow />
      <mesh geometry={geo.trench} material={m.trench} receiveShadow />
      <mesh geometry={geo.steel} material={m.steel} castShadow receiveShadow />
    </group>
  )
}

// ---------- the rest of the complex: lights out to the horizon ----------

interface Lamp {
  p: [number, number, number]
  c: [number, number, number] // hdr color
  size: number // m
  blink: number // 0 steady, else the flash phase
}

const SODIUM: [number, number, number] = [1, 0.5, 0.16]
const WHITE: [number, number, number] = [0.85, 0.88, 1]
const RED: [number, number, number] = [1, 0.05, 0.02]
const lit = (c: [number, number, number], i: number): [number, number, number] => [c[0] * i, c[1] * i, c[2] * i]

// a hangar on the horizon for the lights to outline
const HANGAR = { az: 3.95, dist: 2300, w: 170, h: 125, d: 120 }

function lampsOfTheComplex(): Lamp[] {
  const r = createRng(0x11a7)
  const out: Lamp[] = []
  const polar = (az: number, d: number, y: number): [number, number, number] => [Math.sin(az) * d, y, Math.cos(az) * d]
  // the access road: sodium lamps leading away from the apron, curving off into the dark
  let az = 3.5
  let d = 110
  for (let i = 0; i < 90; i++) {
    out.push({ p: polar(az, d, GROUND_Y + 9), c: lit(SODIUM, 5), size: 0.9, blink: 0 })
    d += 48
    az += 0.004 + (i > 40 ? 0.006 : 0)
  }
  // security lights on the perimeter fence
  for (let i = 0; i < 40; i++) out.push({ p: polar((i / 40) * Math.PI * 2 + 0.05, 420, GROUND_Y + 6), c: lit(WHITE, 2.4), size: 0.7, blink: 0 })
  // lightning masts around the pad: only their beacons show
  for (const a of [0.8, 2.4, 3.9, 5.5]) out.push({ p: polar(a, 190, GROUND_Y + 92), c: lit(RED, 9), size: 1.2, blink: r() })
  // a second pad far off: its tower as a column of lights, floods around it
  const far = (az0: number, d0: number, scale: number, n: number) => {
    for (let i = 0; i < 14; i++) out.push({ p: polar(az0, d0, GROUND_Y + i * 6 * scale), c: lit(WHITE, 4), size: 1.4, blink: 0 })
    for (let i = 0; i < 3; i++) out.push({ p: polar(az0 + (i - 1) * 0.004, d0, GROUND_Y + 86 * scale), c: lit(RED, 10), size: 2, blink: r() })
    for (let i = 0; i < n; i++) {
      const a = az0 + (r() - 0.5) * 0.06
      out.push({ p: polar(a, d0 + (r() - 0.5) * 200, GROUND_Y + 2 + r() * 20), c: lit(r() < 0.6 ? SODIUM : WHITE, 3 + r() * 4), size: 1.5, blink: 0 })
    }
  }
  far(3.15, 3400, 1, 50)
  far(2.15, 7200, 0.9, 30)
  far(5.0, 9800, 0.8, 24)
  // the hangar: rows of lamps along its base, windows, beacons on the roof corners
  const hc = polar(HANGAR.az, HANGAR.dist, 0)
  const side = [Math.cos(HANGAR.az), -Math.sin(HANGAR.az)] // along its front
  const face = HANGAR.dist - HANGAR.d / 2 // the front faces the pad
  for (let i = 0; i < 24; i++) {
    const o = ((i + 0.5) / 24 - 0.5) * HANGAR.w
    const f = polar(HANGAR.az, face - 2, GROUND_Y + 7)
    out.push({ p: [f[0] + side[0] * o, f[1], f[2] + side[1] * o], c: lit(SODIUM, 4), size: 1.6, blink: 0 })
    if (r() < 0.45) {
      const wy = GROUND_Y + 20 + Math.floor(r() * 5) * 20
      out.push({ p: [f[0] + side[0] * o, wy, f[2] + side[1] * o], c: lit(WHITE, 1.6), size: 1.4, blink: 0 })
    }
  }
  for (const s of [-0.5, 0.5]) {
    out.push({ p: [hc[0] + side[0] * s * HANGAR.w, GROUND_Y + HANGAR.h + 1, hc[2] + side[1] * s * HANGAR.w], c: lit(RED, 10), size: 2.2, blink: r() })
  }
  // everything else: scattered buildings and roads out to the horizon
  const rest = QUALITY.distantLights - out.length
  for (let i = 0; i < rest; i++) {
    const cluster = Math.floor(r() * 18)
    const ca = cluster * 2.4 + 0.7
    const cd = 1400 + ((cluster * 7919) % 11) * 1100
    const a = ca + (r() - 0.5) * 0.12
    out.push({ p: polar(a, cd + (r() - 0.5) * 500, GROUND_Y + 2 + r() * 10), c: lit(r() < 0.7 ? SODIUM : WHITE, 1.5 + r() * 3), size: 1.6, blink: 0 })
  }
  return out
}

const lampVertex = /* glsl */ `
attribute vec3 color;
attribute vec2 aLamp; // size m, blink phase
uniform float uPx; // pixels per meter at 1 m from the camera
uniform float uTime;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = aLamp.x * uPx / max(-mv.z, 1.0);
  float size = clamp(px, 2.5, 24.0);
  // smaller than its sprite: dimmer, so a lamp keeps its brightness with distance
  float energy = clamp(px / 2.5, 0.35, 1.0);
  float blink = aLamp.y > 0.0 ? 0.08 + pow(max(0.0, sin((uTime * 0.8 + aLamp.y) * 6.2832)), 12.0) : 1.0;
  vColor = color * energy * blink;
  gl_PointSize = size * 2.2;
  gl_Position = projectionMatrix * mv;
}
`

const lampFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = (exp(-r2 * 9.0) + 0.15 * exp(-r2 * 2.5)) * max(0.0, 1.0 - r2);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`

function DistantLights() {
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const built = useMemo(() => {
    const lamps = lampsOfTheComplex()
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(lamps.flatMap((l) => l.p)), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(lamps.flatMap((l) => l.c)), 3))
    geo.setAttribute('aLamp', new BufferAttribute(new Float32Array(lamps.flatMap((l) => [l.size, l.blink])), 2))
    const mat = new ShaderMaterial({
      vertexShader: lampVertex,
      fragmentShader: lampFragment,
      uniforms: { uPx: { value: 1000 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const points = new Points(geo, mat)
    points.frustumCulled = false
    const hangarGeo = new BoxGeometry(HANGAR.w, HANGAR.h, HANGAR.d)
    const hangarMat = new MeshStandardMaterial({ color: new Color(0.008, 0.008, 0.009), roughness: 0.9, envMapIntensity: 0.05 })
    envLit.add(hangarMat)
    return { points, geo, mat, hangarGeo, hangarMat }
  }, [])
  useEffect(
    () => () => {
      built.geo.dispose()
      built.mat.dispose()
      built.hangarGeo.dispose()
      envLit.delete(built.hangarMat)
      built.hangarMat.dispose()
    },
    [built],
  )
  useFrame(({ camera }) => {
    const fov = (camera as PerspectiveCamera).fov ?? 40
    built.mat.uniforms.uPx.value = (size.height * dpr) / (2 * Math.tan((fov * Math.PI) / 360))
    built.mat.uniforms.uTime.value = rig.vtime
  })
  return (
    <>
      <primitive object={built.points} />
      <mesh
        geometry={built.hangarGeo}
        material={built.hangarMat}
        position={[Math.sin(HANGAR.az) * HANGAR.dist, GROUND_Y + HANGAR.h / 2, Math.cos(HANGAR.az) * HANGAR.dist]}
        rotation-y={HANGAR.az}
      />
    </>
  )
}

// the exhaust boiling out under the mount lights the legs, the apron and the trench; it stays in the scene at
// intensity 0 while the engines are off (adding a light recompiles every lit material)
function ExhaustGlow() {
  const light = useMemo(() => new PointLight(GLOW_COLOR, 0, 0, 2), [])
  useEffect(() => () => light.dispose(), [light])
  useFrame(() => {
    const t = rig.vtime
    const level = rig.altM <= HIDE_ALT_M ? rig.thrust * groundReach(rig.altM) : 0
    light.intensity = GLOW_CD * Math.pow(level, 1.3) * (0.75 + 0.5 * flicker(t, 21))
  })
  return <primitive object={light} position={[0, (GROUND_Y + TRENCH_FLOOR_Y) / 2 + 6, 0]} />
}

export function LaunchPad() {
  const [pending] = useState(loadPadTextures)
  const textures = use(pending)
  const root = useRef<Group>(null)
  const visual = useRef<Group>(null)

  useEffect(() => () => disposePadTextures(), [])

  // after the rig (-10), before the rest of the pad reads its own transform
  useFrame(() => {
    // the near field slides back as the rocket climbs (y) and leans over downrange (x)
    if (root.current) root.current.position.set(-rig.downrange, -rig.nearOffset, 0)
    if (visual.current) visual.current.visible = rig.altM <= HIDE_ALT_M
  }, -1)

  return (
    <group ref={root} name="launch-pad">
      <group ref={visual}>
        <Ground t={textures} />
        <Tower />
        <DistantLights />
      </group>
      <Floodlights />
      <ExhaustGlow />
      <Smoke />
    </group>
  )
}
