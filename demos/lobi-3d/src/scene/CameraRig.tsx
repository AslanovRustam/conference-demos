// Camera flights: into the open cabinet's screen until it covers the viewport, back out, and a
// slow orbit of the hall in attract mode. The fly-in end pose is recomputed every frame from the
// screen's live transform, so a carousel that is still settling (or a window resize mid-flight)
// never leaves a gap at the edges.
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { lobbyStore, useLobby } from '../state/store'
import { coverDistance } from './cameraMath'
import { fx } from './fx'
import { CAMERA_HOME, FOV_HOME, FOV_PLAY, SCREEN } from './layout'

const DURATION = { in: 1.5, out: 1.1, orbit: 9, home: 0.7 } as const
// a hair closer than an exact fit so no sliver of cabinet shows at the edges
const OVERSCAN = 0.98
/** in attract mode every third self-turn of the carousel gets a camera orbit */
const ORBIT_EVERY = 3

const HOME_POS = new THREE.Vector3(...CAMERA_HOME.position)
const HOME_TARGET = new THREE.Vector3(...CAMERA_HOME.target)

// The game iframe shares this main thread, and its first frames (asset decode, shader compile)
// can block for seconds. GSAP's lag smoothing would then crawl at 33 ms per frame and stall the
// flight; without it the flight keeps wall-clock time and simply skips frames.
gsap.ticker.lagSmoothing(0)

type Kind = keyof typeof DURATION
type Flight = { kind: Kind; t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; fromFov: number; tween: gsap.core.Tween }

/** Attract orbit at progress t: swing right, back, left, back, rising and closing in mid-way. */
function orbitPose(t: number, out: THREE.Vector3): THREE.Vector3 {
  const theta = Math.sin(t * Math.PI * 2) * 0.55
  const lift = Math.sin(t * Math.PI)
  const r = Math.hypot(HOME_POS.x, HOME_POS.z) * (1 - lift * 0.12)
  return out.set(Math.sin(theta) * r, HOME_POS.y + lift * 0.9, Math.cos(theta) * r)
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const phase = useLobby((s) => s.phase)
  const target = useRef(HOME_TARGET.clone())
  const flight = useRef<Flight | null>(null)
  const tmp = useRef({ pos: new THREE.Vector3(), normal: new THREE.Vector3(), scale: new THREE.Vector3(), endPos: new THREE.Vector3() })

  const start = useRef((kind: Kind) => {
    flight.current?.tween.kill()
    const f: Flight = {
      kind,
      t: 0,
      fromPos: camera.position.clone(),
      fromTarget: target.current.clone(),
      fromFov: camera.fov,
      tween: null as unknown as gsap.core.Tween,
    }
    f.tween = gsap.to(f, {
      t: 1,
      duration: DURATION[kind],
      ease: kind === 'orbit' ? 'none' : 'power3.inOut',
      onComplete: () => {
        if (kind === 'in') return lobbyStore.getState().markCameraArrived()
        flight.current = null
        if (kind === 'out') lobbyStore.getState().exitDone()
      },
    })
    flight.current = f
  })

  useEffect(() => {
    camera.position.copy(HOME_POS)
    camera.fov = FOV_HOME
    camera.updateProjectionMatrix()
  }, [camera])

  useEffect(() => {
    if (phase === 'entering') start.current('in')
    if (phase === 'exiting') start.current('out')
  }, [phase])

  // attract: orbit on every third self-turn; any input (attract off) brings the camera home
  useEffect(() => {
    let turns = 0
    return lobbyStore.subscribe((s, prev) => {
      if (s.phase !== 'lobby') return
      if (s.attract && s.activeIndex !== prev.activeIndex && ++turns % ORBIT_EVERY === 0) start.current('orbit')
      if (!s.attract && prev.attract) {
        turns = 0
        if (flight.current?.kind === 'orbit') start.current('home')
      }
    })
  }, [])

  useEffect(() => () => void flight.current?.tween.kill(), [])

  useFrame(() => {
    const f = flight.current
    if (f?.kind === 'orbit') {
      orbitPose(f.t, camera.position)
      target.current.copy(HOME_TARGET)
    } else if (f) {
      let endTarget = HOME_TARGET
      let endPos = HOME_POS
      let endFov = FOV_HOME
      if (f.kind === 'in') {
        const open = lobbyStore.getState().openSlot
        const screen = open === null ? undefined : scene.getObjectByName(`screen-${open}`)
        if (screen) {
          const { pos, normal, scale } = tmp.current
          screen.getWorldPosition(pos)
          screen.getWorldDirection(normal)
          screen.getWorldScale(scale)
          const dist = coverDistance(SCREEN.w * scale.x, SCREEN.h * scale.y, FOV_PLAY, size.width / size.height) * OVERSCAN
          endTarget = pos
          endPos = tmp.current.endPos.copy(pos).addScaledVector(normal, dist)
          endFov = FOV_PLAY
        }
      }
      camera.position.lerpVectors(f.fromPos, endPos, f.t)
      target.current.lerpVectors(f.fromTarget, endTarget, f.t)
      camera.fov = THREE.MathUtils.lerp(f.fromFov, endFov, f.t)
      camera.updateProjectionMatrix()
      if (f.kind === 'in') fx.focus = Math.max(fx.focus, f.t)
      if (f.kind === 'out') fx.focus = Math.min(fx.focus, 1 - f.t)
    }
    camera.lookAt(target.current)
  })

  return null
}
