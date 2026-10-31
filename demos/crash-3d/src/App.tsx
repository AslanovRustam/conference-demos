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
import { reloadOnContextLoss } from './platform/contextLoss'
import { exitToLobby, parseLobbyMessage, readyToLobby } from './platform/embed'
import { gateVibrate } from './platform/haptics'
import { createSafeStorage } from './platform/storage'
import { createCodeDetector } from './platform/presenter'
import { loadCloudNoise } from './scene/clouds/noise'
import { QUALITY } from './scene/quality'
import { rig } from './scene/rig'
import { Stage } from './scene/Stage'
import { Hud } from './ui/Hud'
import { ExitButton } from './ui/ExitButton'
import { Splash } from './ui/Splash'
import './ui/splash.css'

// the cloud noise takes a moment in its workers: start it with the page, the stage waits for it while it loads
void loadCloudNoise()
// the idle loop plays to nobody: no buzzing an idle phone
gateVibrate(() => !useGame.getState().snap.attract)

// production only: dev remounts dispose the renderer (a context loss of its own)
function onCanvas({ gl }: { gl: { domElement: HTMLCanvasElement } }) {
  if (import.meta.env.PROD) reloadOnContextLoss(gl.domElement, () => location.reload(), createSafeStorage(() => sessionStorage))
}

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
    // the stand boots into the idle loop once its splash is gone; the lobby (embed) and debug sessions start on the
    // betting screen. the lobby hears that the game is ready
    const unsubReady = useGame.subscribe((s, prev) => {
      if (!s.ready || prev.ready) return
      readyToLobby()
      if (!params.embed && !params.debug) attract.start()
    })
    // the lobby mutes the game with itself (not saved: the visitor's own choice stays)
    const onLobby = (e: MessageEvent) => {
      const msg = parseLobbyMessage(e, location.origin, window.parent)
      if (msg?.type === 'mute') useGame.getState().setMuted(msg.muted)
    }
    if (params.embed) window.addEventListener('message', onLobby)
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
      exit: () => exitToLobby(),
      // nothing reaches the game under the splash
      anyInput: () => !isStageReady() || attract.input(),
      code: (k) => feed(k, performance.now()),
    })
    return () => {
      stopLoop()
      unbind()
      attract.dispose()
      unsubReady()
      window.removeEventListener('message', onLobby)
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
        onCreated={onCanvas}
      >
        <Stage />
      </Canvas>
      <Hud />
      <Splash />
      {/* over the splash and the idle loop: the lobby's way out works from the first moment */}
      <div className="hud hud-top" data-embed={params.embed || undefined}>
        <ExitButton />
      </div>
    </>
  )
}
