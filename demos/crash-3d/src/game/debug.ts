import type { RoundSnapshot } from '../core/types'
import { params } from '../platform/params'
import { runtime } from './runtime'
import { useGame } from './store'

declare global {
  interface Window {
    __crash?: { snap: () => RoundSnapshot; setNextCrash: (x: number) => void }
    __crashReady?: boolean
  }
}

// debug api exists only with ?debug=1
export function installDebug(): void {
  if (!params.debug) return
  window.__crash = {
    snap: () => runtime.engine.snapshot(),
    setNextCrash: (x) => runtime.engine.setNextCrash(x),
  }
}

// the scene is on screen (the splash, the input and the attract idle clock wait for it)
export function isStageReady(): boolean {
  return useGame.getState().ready
}

// the stage calls it once the scene has loaded and 30 frames have rendered. screenshots and e2e wait for
// window.__crashReady; the hud fonts must be in too
export function markReady(): void {
  useGame.setState({ ready: true })
  if (!params.debug) return
  void document.fonts.ready.then(() => {
    window.__crashReady = true
  })
}
