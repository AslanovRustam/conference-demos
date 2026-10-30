import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { bindAudio, bindVisibility } from './audio/bindings'
import { createAudio } from './audio/core'
import { createAttractMode } from './game/attractMode'
import { installDebug, isStageReady } from './game/debug'
import { startLoop } from './game/loop'
import { primaryAction, runtime } from './game/runtime'
import { toggleMute, useGame } from './game/store'
import { bindKeyboard } from './platform/input'
import { params } from './platform/params'
import { createCodeDetector } from './platform/presenter'
import { loadCloudNoise } from './scene/clouds/noise'
import { QUALITY } from './scene/quality'
import { rig } from './scene/rig'
import { Stage } from './scene/Stage'
import { Hud } from './ui/Hud'

// the cloud noise takes a moment in its workers: start it with the page, the stage waits for it while it loads
void loadCloudNoise()

// the 3d stage fills the screen, the dom hud sits on top
export default function App() {
  useEffect(() => {
    const { engine } = runtime
    installDebug()
    if (params.rare !== null) engine.forceRare(params.rare)
    if (params.freeze !== null) engine.freezeAt(params.freeze)
    // sound: browsers keep it silent until the first touch or key, the mute state comes from the store
    const audio = createAudio(useGame.getState().muted)
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    const unbindAudio = bindAudio(runtime.emitter, audio.sfx)
    const unbindVisibility = bindVisibility(document, audio.ctx, () => useGame.getState().muted)
    const unsubMute = useGame.subscribe((s, prev) => {
      if (s.muted !== prev.muted) audio.setMuted(s.muted)
    })
    // the stand's idle loop; any key or touch pokes it, the first one after attract only wakes the game
    const attract = createAttractMode(engine, undefined, () => !isStageReady())
    const wake = () => void attract.input()
    window.addEventListener('pointerdown', wake, true)
    const stopLoop = startLoop(() => {
      attract.tick()
      audio.update(rig)
    })
    const feed = createCodeDetector({
      HYPER: () => engine.arm('warp'),
      NUKE: () => engine.arm('instant'),
    })
    const unbind = bindKeyboard(window, {
      primary: primaryAction,
      bet: (d) => engine.stepBet(d),
      auto: (d) => engine.stepAuto(d),
      toggleAuto: () => engine.toggleAuto(),
      mute: toggleMute,
      exit: () => {},
      anyInput: () => attract.input(),
      code: (k) => feed(k, performance.now()),
    })
    return () => {
      stopLoop()
      unbind()
      attract.dispose()
      window.removeEventListener('pointerdown', wake, true)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      unbindAudio()
      unbindVisibility()
      unsubMute()
      audio.dispose()
    }
  }, [])

  return (
    <>
      {/* flat: no renderer tone mapping, the post chain does it (AgX) */}
      <Canvas
        style={{ position: 'fixed', inset: 0 }}
        dpr={QUALITY.dpr}
        flat
        shadows="percentage"
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ near: 0.5, far: 30000, fov: 40 }}
      >
        <Stage />
      </Canvas>
      <Hud />
    </>
  )
}
