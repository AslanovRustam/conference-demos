import { useGame } from '../game/store'

// a tiny tell for the presenter: the next round is rigged
export function PresenterDot() {
  const armed = useGame((s) => s.snap.armed !== null)
  return armed ? <span className="hud-presenter-dot" aria-hidden /> : null
}
