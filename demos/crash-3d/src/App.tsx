import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { installDebug } from './game/debug'
import { startLoop } from './game/loop'
import { primaryAction, runtime } from './game/runtime'
import { toggleMute } from './game/store'
import { bindKeyboard } from './platform/input'
import { params } from './platform/params'
import { createCodeDetector } from './platform/presenter'
import { QUALITY } from './scene/quality'
import { Stage } from './scene/Stage'
import { Hud } from './ui/Hud'

// the 3d stage fills the screen, the dom hud sits on top
export default function App() {
  useEffect(() => {
    const { engine } = runtime
    installDebug()
    if (params.freeze !== null) engine.freezeAt(params.freeze)
    const stopLoop = startLoop(() => {})
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
      anyInput: () => {},
      code: (k) => feed(k, performance.now()),
    })
    return () => {
      stopLoop()
      unbind()
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
