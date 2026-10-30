import { useEffect } from 'react'
import { installDebug } from './game/debug'
import { startLoop } from './game/loop'
import { primaryAction, runtime } from './game/runtime'
import { toggleMute } from './game/store'
import { bindKeyboard } from './platform/input'
import { params } from './platform/params'
import { createCodeDetector } from './platform/presenter'
import { Hud } from './ui/Hud'

// the scene is wired in later tasks: hud over a black screen for now
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

  return <Hud />
}
