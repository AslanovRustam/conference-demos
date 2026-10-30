// Camera flights: into the open cabinet's screen until it covers the viewport, and back out.
// The end pose is recomputed every frame from the screen's live transform, so a carousel that
// is still settling (or a window resize mid-flight) never leaves a gap at the edges.
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { lobbyStore, useLobby } from '../state/store'
import { coverDistance } from './cameraMath'
import { fx } from './fx'
import { CAMERA_HOME, FOV_HOME, FOV_PLAY, SCREEN } from './layout'

const IN_SEC = 1.5
const OUT_SEC = 1.1
// a hair closer than an exact fit so no sliver of cabinet shows at the edges
const OVERSCAN = 0.98

const HOME_POS = new THREE.Vector3(...CAMERA_HOME.position)
const HOME_TARGET = new THREE.Vector3(...CAMERA_HOME.target)

// The game iframe shares this main thread, and its first frames (asset decode, shader compile)
// can block for seconds. GSAP's lag smoothing would then crawl at 33 ms per frame and stall the
// flight; without it the flight keeps wall-clock time and simply skips frames.
gsap.ticker.lagSmoothing(0)

type Flight = { kind: 'in' | 'out'; t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; fromFov: number; tween: gsap.core.Tween }

export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const phase = useLobby((s) => s.phase)
  const target = useRef(HOME_TARGET.clone())
  const flight = useRef<Flight | null>(null)
  const tmp = useRef({ pos: new THREE.Vector3(), normal: new THREE.Vector3(), scale: new THREE.Vector3(), endPos: new THREE.Vector3() })

  useEffect(() => {
    camera.position.copy(HOME_POS)
    camera.fov = FOV_HOME
    camera.updateProjectionMatrix()
  }, [camera])

  useEffect(() => {
    const start = (kind: Flight['kind']) => {
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
        duration: kind === 'in' ? IN_SEC : OUT_SEC,
        ease: 'power3.inOut',
        onComplete: () => {
          if (kind === 'in') lobbyStore.getState().markCameraArrived()
          else {
            flight.current = null
            lobbyStore.getState().exitDone()
          }
        },
      })
      flight.current = f
    }
    if (phase === 'entering') start('in')
    if (phase === 'exiting') start('out')
  }, [phase, camera])

  useEffect(() => () => void flight.current?.tween.kill(), [])

  useFrame(() => {
    const f = flight.current
    if (f) {
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
      fx.focus = f.kind === 'in' ? Math.max(fx.focus, f.t) : Math.min(fx.focus, 1 - f.t)
    }
    camera.lookAt(target.current)
  })

  return null
}
