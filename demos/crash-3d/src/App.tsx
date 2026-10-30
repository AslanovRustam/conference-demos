import { brandLogo } from '@brand/tokens'
import { useEffect } from 'react'
import { installDebug } from './game/debug'
import { startLoop } from './game/loop'
import { primaryAction, runtime } from './game/runtime'
import { useGame } from './game/store'
import { bindKeyboard } from './platform/input'
import { params } from './platform/params'
import { createCodeDetector } from './platform/presenter'
import { safeStorage } from './platform/storage'

// ui and scene are wired in later tasks: black screen with the logo for now
export default function App() {
  useEffect(() => {
    const { engine } = runtime
    installDebug()
    if (params.freeze !== null) engine.freezeAt(params.freeze)
    const stopLoop = startLoop(() => {})
    const feed = createCodeDetector({
      WARP: () => engine.arm('warp'),
      BOOM: () => engine.arm('instant'),
    })
    const unbind = bindKeyboard(window, {
      primary: primaryAction,
      bet: (d) => engine.stepBet(d),
      auto: (d) => engine.stepAuto(d),
      toggleAuto: () => engine.toggleAuto(),
      mute: () => {
        const muted = !useGame.getState().muted
        useGame.getState().setMuted(muted)
        safeStorage.set('muted', muted ? '1' : '0')
      },
      exit: () => {},
      anyInput: () => {},
      code: (k) => feed(k, performance.now()),
    })
    return () => {
      stopLoop()
      unbind()
    }
  }, [])

  return <img src={brandLogo.red} alt="Clickable" style={{ position: 'absolute', top: 16, left: 16, height: 24 }} />
}
