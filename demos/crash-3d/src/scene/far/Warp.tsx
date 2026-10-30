import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AddEquation,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  CylinderGeometry,
  LineSegments,
  Mesh,
  OneFactor,
  ShaderMaterial,
  ZeroFactor,
  type Material,
} from 'three'
import { createRng } from '../../core/rng'
import { fx } from '../fx'
import { rig } from '../rig'

const STREAKS = 2400
const SPAN = 3000 // height of the column of passing stars around the camera
const R_MIN = 40
const R_MAX = 900
const SPACE_IN = [2.6, 3.2] as const // the passing stars appear once there is no sky left
const WARP = [5, 5.35] as const // stageF over which the warp kicks in
const TUNNEL_R = 160
const TUNNEL_L = 6000

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ramp = (a: number, b: number, x: number) => clamp01((x - a) / (b - a))

function farAdditive(m: Material) {
  m.transparent = false
  m.depthTest = false
  m.depthWrite = false
  m.blending = CustomBlending
  m.blendEquation = AddEquation
  m.blendSrc = OneFactor
  m.blendDst = OneFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
}

// passing stars streaming down past the camera (the rocket climbs), faster with speed, stretched into lines in the
// warp; a noise tunnel with split colour around the camera; the chroma for the warp
export function Warp() {
  const streaks = useMemo(() => {
    const rng = createRng(0x3a91)
    const pos = new Float32Array(STREAKS * 6)
    const end = new Float32Array(STREAKS * 2) // 0 head, 1 tail
    const shade = new Float32Array(STREAKS * 2)
    for (let i = 0; i < STREAKS; i++) {
      const a = rng() * Math.PI * 2
      const r = R_MIN + (R_MAX - R_MIN) * rng() ** 0.7
      const y = (rng() - 0.5) * SPAN
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a) * r, y, Math.sin(a) * r], i * 6)
      end.set([0, 1], i * 2)
      const b = 0.25 + 0.75 * rng() ** 2
      shade.set([b, b], i * 2)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('end', new BufferAttribute(end, 1))
    g.setAttribute('shade', new BufferAttribute(shade, 1))
    const m = new ShaderMaterial({
      uniforms: { uScroll: { value: 0 }, uStretch: { value: 1 }, uAlpha: { value: 0 }, uSpan: { value: SPAN } },
      vertexShader: /* glsl */ `
        attribute float end;
        attribute float shade;
        uniform float uScroll;
        uniform float uStretch;
        uniform float uSpan;
        varying float vShade;
        varying float vEnd;
        void main() {
          vec3 p = position;
          // stream downwards and wrap around the column; the tail trails above the head
          p.y = mod(p.y - uScroll + uSpan * 0.5, uSpan) - uSpan * 0.5 + end * uStretch;
          vShade = shade;
          vEnd = end;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying float vShade;
        varying float vEnd;
        void main() {
          // bright head, fading tail, a cold tint
          float k = (1.0 - vEnd * 0.85) * vShade * uAlpha;
          gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * k * 1.6, 0.0);
        }`,
    })
    farAdditive(m)
    const lines = new LineSegments(g, m)
    lines.frustumCulled = false
    lines.renderOrder = -85
    return { g, m, lines, scroll: 0 }
  }, [])

  const tunnel = useMemo(() => {
    const g = new CylinderGeometry(TUNNEL_R, TUNNEL_R, TUNNEL_L, 64, 1, true)
    const m = new ShaderMaterial({
      uniforms: { uScroll: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vY;
        void main() {
          vUv = uv;
          vY = position.y / ${TUNNEL_L.toFixed(1)};
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uScroll;
        uniform float uAlpha;
        varying vec2 vUv;
        varying float vY;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        // thin lines of light racing along the tunnel: only some angular lanes are lit, each flickers along its length;
        // the colour channels run a little apart at the line edges (split colour)
        float streak(vec2 uv, float shift) {
          vec2 p = vec2(uv.x * 140.0 + shift, uv.y * 90.0 - uScroll * 6.0);
          float lane = step(0.82, hash(vec2(floor(p.x), 3.0)));
          float flick = smoothstep(0.5, 0.95, noise(vec2(floor(p.x) * 7.3, p.y)));
          float w = 1.0 - abs(fract(p.x) - 0.5) * 2.0;
          return lane * flick * pow(w, 8.0);
        }
        void main() {
          vec3 c = vec3(streak(vUv, -0.06), streak(vUv, 0.0), streak(vUv, 0.06)) * vec3(0.8, 0.95, 1.5);
          // dark at both ends so the tube has no visible rim
          float ends = smoothstep(0.5, 0.15, abs(vY));
          gl_FragColor = vec4(c * ends * uAlpha * 4.0, 0.0);
        }`,
      side: BackSide,
    })
    farAdditive(m)
    return { g, m }
  }, [])
  const tube = useRef<Mesh>(null)

  useEffect(
    () => () => {
      streaks.g.dispose()
      streaks.m.dispose()
      tunnel.g.dispose()
      tunnel.m.dispose()
    },
    [streaks, tunnel],
  )

  useFrame((_, dt) => {
    const step = dt * rig.slowmo
    const space = ramp(SPACE_IN[0], SPACE_IN[1], rig.stageF)
    const warp = ramp(WARP[0], WARP[1], rig.stageF)
    const moving = rig.phase === 'flight' || rig.phase === 'ejected' ? 1 : 0
    // metres of passing stars per second: a crawl in orbit, a torrent in the warp
    const speed = moving * (60 + 900 * rig.speed + 9000 * warp)
    streaks.scroll = (streaks.scroll + speed * step) % SPAN
    const su = streaks.m.uniforms
    su.uScroll.value = streaks.scroll
    // short glints while cruising, long lines only in the warp
    su.uStretch.value = 0.6 + speed * (0.004 + 0.014 * warp)
    su.uAlpha.value = space
    streaks.lines.visible = space > 0.001

    tunnel.m.uniforms.uScroll.value += step * (2 + 10 * warp) * moving
    tunnel.m.uniforms.uAlpha.value = warp
    if (tube.current) tube.current.visible = warp > 0.001

    // colour splits in the warp. no zoom blur for speed: it blurs towards the screen centre, but the rocket flies up
    // the screen, so it smeared the passing stars sideways into blocks; the stretched streaks carry the speed
    fx.chroma = 0.35 * warp * moving
  })

  return (
    <>
      <primitive object={streaks.lines} />
      <mesh ref={tube} geometry={tunnel.g} material={tunnel.m} frustumCulled={false} renderOrder={-40} visible={false} />
    </>
  )
}
