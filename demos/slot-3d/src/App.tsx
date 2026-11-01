import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { audio } from './audio/audio'
import { enterAttract, noteActivity, requestSpin, resetBalance, startAttractWatch } from './game/director'
import { Stage } from './scene/Stage'
import { VaultEnvironment, VaultRoom } from './scene/vault/Room'
import { params, QUALITY, type Quality } from './state/params'
import { game, useGame } from './state/store'
import { Hud } from './ui/Hud'
import { BannerOverlay, BigWinOverlay, Fps, MultiplierBurst, PresenterPanel, StepWinToast, VaultGate } from './ui/Overlays'

const NEXT_QUALITY: Record<Quality, Quality> = { high: 'medium', medium: 'low', low: 'high' }
const DPR_STEPS = [1, 0.8, 0.65]

/**
 * Automatic tuning only touches render resolution, never the effects, so nothing gets rebuilt.
 * The new value is queued and applied when the next spin starts: resizing clears the canvas for a
 * frame, and the spin's launch flash hides that.
 */
function queueDpr(dir: 1 | -1) {
  if (params.presenter) return
  const s = game()
  const current = s.pendingDprScale ?? s.dprScale
  const i = DPR_STEPS.indexOf(current) - dir
  if (i < 0 || i >= DPR_STEPS.length) return
  useGame.setState({ pendingDprScale: DPR_STEPS[i] })
}

function useInput() {
  useEffect(() => {
    const onPointer = () => {
      void audio.unlock()
      noteActivity()
    }
    const onKey = (e: KeyboardEvent) => {
      void audio.unlock()
      const s = game()
      if (s.attract) {
        noteActivity()
        return
      }
      noteActivity()
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        // opens the vault when it is shut, spins when it is open
        requestSpin()
        return
      }
      if (!e.shiftKey) return
      // presenter hotkeys use physical keys so they work with any keyboard layout
      switch (e.code) {
        case 'KeyB':
          return requestSpin('bonus')
        case 'KeyW':
          return requestSpin('bigwin')
        case 'KeyR':
          return resetBalance()
        case 'KeyF':
          return useGame.setState({ showFps: !s.showFps })
        case 'KeyA':
          return enterAttract()
        case 'KeyQ':
          return useGame.setState({ quality: NEXT_QUALITY[s.quality] })
        case 'KeyH':
          return useGame.setState({ presenterPanel: !s.presenterPanel })
      }
    }
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}

export default function App() {
  const quality = useGame((s) => s.quality)
  const world = useGame((s) => s.world)
  const started = useGame((s) => s.started)
  const dprScale = useGame((s) => s.dprScale)
  const dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, QUALITY[quality].dpr) * dprScale)

  useInput()
  useEffect(() => startAttractWatch(), [])
  useEffect(() => useGame.setState({ muted: audio.muted }), [])
  useEffect(() => {
    if (started) audio.setMusic(world === 'treasury' ? 'bonus' : 'base')
  }, [started, world])

  return (
    <div className={`app app--${world}`}>
      <Canvas
        className="canvas"
        dpr={dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 35, near: 0.1, far: 250, position: [0, 1, 24] }}
        onCreated={({ gl, scene, camera }) => {
          gl.localClippingEnabled = true
          if (import.meta.env.DEV) Object.assign(window, { __three: { gl, scene, camera } })
        }}
      >
        <Suspense fallback={null}>
          <VaultRoom />
          <VaultEnvironment world={world} />
          <Stage />
        </Suspense>
        {/* not on the start screen: the first seconds are shader compilation, and a change there shows as a blink */}
        {started && !new URLSearchParams(location.search).has('quality') && (
          <PerformanceMonitor flipflops={6} onDecline={() => queueDpr(-1)} onIncline={() => queueDpr(1)} />
        )}
      </Canvas>
      <div id="flash" className="flash" />
      <StepWinToast />
      <MultiplierBurst />
      <Hud />
      <BannerOverlay />
      <BigWinOverlay />
      <PresenterPanel />
      <Fps />
      <VaultGate />
    </div>
  )
}
