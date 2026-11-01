import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import gsap from 'gsap'
import { BlendFunction, ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../audio/audio'
import { randomGrid } from '../game/engine'
import { QUALITY } from '../state/params'
import { useGame } from '../state/store'
import { bridge, type StageApi } from './bridge'
import { Fx } from './fx'
import { GridView } from './GridView'
import { VaultDoor } from './vault/Door'
import { VAULT, vaultLight } from './vault/layout'

const FOV = 35

/** what the camera keeps in frame: the closed door from the room, or the reels through the open doorway */
const SHOTS = {
  door: { x: 0, y: 0.55, z: 0, w: 13.4, h: 13.2 },
  play: { x: 0, y: VAULT.gridY + 0.3, z: VAULT.gridZ, w: 9.2, h: 8.2 },
}

/** screen fractions taken by the HUD, so the machine sits in the free band */
function hudBands(aspect: number) {
  return aspect < 0.85 ? { top: 0.07, bottom: 0.27 } : { top: 0.075, bottom: 0.15 }
}

const wait = (s: number) => new Promise<void>((resolve) => gsap.delayedCall(s, resolve))
const frames = (n: number) => new Promise<void>((resolve) => {
  const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step))
  requestAnimationFrame(step)
})

export function Stage() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const quality = useGame((s) => s.quality)
  const world = useGame((s) => s.world)
  // pools are sized once; later quality changes only touch resolution, bloom and spark counts
  const limits = QUALITY[useRef(quality).current]

  const fx = useMemo(
    () =>
      new Fx(limits, [
        // coins burst out over the doorway sill towards the viewer
        new THREE.Vector3(-3, -4.1, 0.9),
        new THREE.Vector3(3, -4.1, 0.9),
        new THREE.Vector3(0, -4.4, 1.3),
      ]),
    [limits],
  )
  const grid = useMemo(() => {
    const g = new GridView(fx, randomGrid(Math.random))
    g.root.position.set(0, VAULT.gridY, VAULT.gridZ)
    g.windowEdge = { halfH: VAULT.bezelInnerHalfH, z: VAULT.bezelFrontZ }
    return g
  }, [fx])
  useEffect(() => {
    grid.sparksPerSymbol = quality === 'high' ? 70 : quality === 'medium' ? 42 : 22
  }, [grid, quality])
  const door = useMemo(() => {
    const d = new VaultDoor()
    d.leak(0.35, 0.1)
    return d
  }, [])

  const rig = useRef({ shot: 0, dolly: 1, pitch: 0.05, shake: 0, fov: 0, orbit: 0, punch: 0 })
  const post = useRef({ bloom: 0, ca: 0 })
  const bloomRef = useRef<BloomEffect>(null)
  const caRef = useRef<ChromaticAberrationEffect>(null)
  const distances = useRef({ door: 30, play: 20 })

  useEffect(() => {
    gl.localClippingEnabled = true
    // the gems' refraction pass does not need full resolution
    gl.transmissionResolutionScale = 0.5
    vaultLight.interior = 0
    let alive = true
    // lift the loading screen only once the scene is truly ready: let the environment map render,
    // compile every shader up front, then let a couple of frames land. Otherwise compilation stalls
    // the loader's fade halfway and it vanishes in one jump, which reads as a blink.
    void (async () => {
      await frames(2)
      try {
        await gl.compileAsync(scene, camera)
      } catch {
        // older drivers: shaders compile on first use instead
      }
      await frames(3)
      if (alive) useGame.setState({ ready: true })
    })()
    return () => {
      alive = false
    }
  }, [gl, scene, camera])

  // keep the subject framed above the HUD for any screen shape
  useEffect(() => {
    const aspect = size.width / size.height
    const bands = hudBands(aspect)
    const band = 1 - bands.top - bands.bottom
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const fit = (s: { w: number; h: number }) => Math.max(s.h / (2 * band * tan), s.w / (2 * 0.95 * tan * aspect))
    distances.current = { door: fit(SHOTS.door), play: fit(SHOTS.play) }
    const shift = ((bands.bottom - bands.top) / 2) * size.height
    camera.setViewOffset(size.width, size.height, 0, shift, size.width, size.height)
    camera.updateProjectionMatrix()
  }, [camera, size])

  useEffect(() => {
    const api: StageApi = {
      shake(strength, duration) {
        rig.current.shake = Math.max(rig.current.shake, strength)
        gsap.to(rig.current, { shake: 0, duration, ease: 'power2.out', overwrite: 'auto' })
      },
      flash(strength, duration = 0.5) {
        post.current.bloom = Math.max(post.current.bloom, strength)
        post.current.ca = Math.max(post.current.ca, strength * 0.004)
        gsap.to(post.current, { bloom: 0, ca: 0, duration, ease: 'power2.out', overwrite: 'auto' })
      },
      anticipation(on) {
        gsap.to(rig.current, { dolly: on ? 0.84 : 1, pitch: on ? 0.02 : 0.05, duration: on ? 1.4 : 0.6, ease: 'power2.inOut', overwrite: 'auto' })
      },
      async openVault() {
        audio.play('vaultOpen')
        door.leak(0.8, 0.4)
        gsap.to(vaultLight, { interior: 0.12, duration: 0.6 })
        await door.unlock(() => api.shake(0.05, 0.15))
        api.shake(0.25, 0.45)
        const swinging = door.open()
        door.leak(0, 1.2)
        gsap.to(vaultLight, { interior: 1, duration: 1.8, delay: 0.45, ease: 'power2.in' })
        gsap.delayedCall(0.9, () => api.flash(0.5, 1.4))
        gsap.to(rig.current, { shot: 1, orbit: 0, duration: 2.7, delay: 0.3, ease: 'power2.inOut', overwrite: 'auto' })
        await swinging
        await wait(0.35)
      },
      async closeVault() {
        gsap.to(rig.current, { shot: 0, duration: 1.7, ease: 'power2.inOut', overwrite: 'auto' })
        gsap.to(vaultLight, { interior: 0, duration: 1.1, delay: 0.35 })
        await door.close(1.35)
        audio.play('reelStop', 0)
        api.shake(0.45, 0.55)
        api.flash(0.4, 0.5)
        await door.lock()
        door.leak(0.35, 0.8)
      },
      async enterBonus() {
        await api.closeVault()
        // gold pours out round the seam: the treasury is waking up behind the door
        useGame.setState({ world: 'treasury' })
        door.leak(1.2, 0.5)
        api.flash(0.6, 0.8)
        await wait(0.9)
        await api.openVault()
      },
      async exitBonus() {
        await api.closeVault()
        useGame.setState({ world: 'vault' })
        await wait(0.4)
        await api.openVault()
      },
      coins(rate) {
        fx.coins.rate = rate
      },
      coinBurst(count) {
        fx.coins.burst(count)
      },
      coinRain(rate) {
        fx.coins.rainRate = rate
      },
      multiplierHit() {
        api.flash(0.3, 0.4)
        const at = new THREE.Vector3(0, VAULT.gridY + VAULT.bezelH / 2 + 0.42, VAULT.gridZ + 0.9)
        fx.sparks.emit(at, world === 'treasury' ? '#ffd76a' : '#ff5a4a', { count: 40, speed: 3.5, size: 0.1, life: 0.8, lift: 1 })
      },
      punch(strength) {
        gsap.fromTo(rig.current, { punch: strength }, { punch: 0, duration: 0.45, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' })
      },
      orbit(on) {
        gsap.to(rig.current, { orbit: on ? 1 : 0, duration: 1.5, ease: 'power2.inOut', overwrite: 'auto' })
      },
    }
    bridge.grid = grid
    bridge.stage = api
    return () => {
      if (bridge.grid === grid) bridge.grid = null
      if (bridge.stage === api) bridge.stage = null
    }
  }, [grid, fx, door, world])

  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const t = state.clock.elapsedTime
    grid.update(dt)
    fx.update(dt)
    fx.sparks.material.uniforms.uViewport.value = size.height * state.viewport.dpr

    const r = rig.current
    const k = r.shot
    target.set(
      THREE.MathUtils.lerp(SHOTS.door.x, SHOTS.play.x, k),
      THREE.MathUtils.lerp(SHOTS.door.y, SHOTS.play.y, k),
      THREE.MathUtils.lerp(SHOTS.door.z, SHOTS.play.z, k),
    )
    // a slow handheld drift keeps the doorway and the stones readable in 3D; on the door shot it is
    // almost still, otherwise the big panelled wall visibly slides and its seams seem to swim
    const drift = THREE.MathUtils.lerp(0.15, 1, k)
    const yaw = (Math.sin(t * 0.16) * 0.05 + Math.sin(t * 0.07) * 0.02) * drift + r.orbit * Math.sin(t * 0.2) * 0.42
    const pitch = r.pitch + 0.02 + Math.sin(t * 0.13) * 0.015 * drift + r.orbit * (0.05 + Math.sin(t * 0.17) * 0.04)
    const d = THREE.MathUtils.lerp(distances.current.door, distances.current.play, k) * r.dolly * (1 + r.orbit * 0.05) * (1 - r.punch)
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * d,
      target.y + Math.sin(pitch) * d,
      target.z + Math.cos(yaw) * Math.cos(pitch) * d,
    )
    if (r.shake > 0) {
      const s = r.shake
      camera.position.x += (Math.sin(t * 61) + Math.sin(t * 37)) * 0.16 * s
      camera.position.y += (Math.sin(t * 53) + Math.sin(t * 29)) * 0.16 * s
    }
    camera.lookAt(target)
    if (r.shake > 0) camera.rotation.z += Math.sin(t * 47) * 0.018 * r.shake
    camera.updateMatrixWorld()
    grid.updateClip(camera)
    const fov = FOV + r.fov
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    const bloom = bloomRef.current
    if (bloom) bloom.intensity = (world === 'treasury' ? 0.7 : 0.55) + post.current.bloom * 2
    caRef.current?.offset.set(post.current.ca + r.shake * 0.002, post.current.ca * 0.6)
  })

  const caOffset = useMemo(() => new THREE.Vector2(0, 0), [])

  return (
    <>
      <primitive object={grid.root} />
      <primitive object={fx.root} />
      <primitive object={door.root} />
      {/* no MSAA: multisampled float targets are the most expensive thing on integrated GPUs; SMAA below smooths edges */}
      <EffectComposer multisampling={0}>
        {quality === 'high' ? <DepthOfField target={target} focusRange={10} bokehScale={2.2} resolutionScale={0.5} /> : <></>}
        <Bloom ref={bloomRef} mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.25} intensity={0.55} radius={0.7} levels={QUALITY[quality].bloomLevels} />
        <ChromaticAberration ref={caRef} offset={caOffset} radialModulation modulationOffset={0.25} blendFunction={BlendFunction.NORMAL} />
        <Vignette darkness={0.5} offset={0.3} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <SMAA />
      </EffectComposer>
    </>
  )
}
