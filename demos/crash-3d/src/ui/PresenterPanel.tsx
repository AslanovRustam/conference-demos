import type { PointerEvent } from 'react'
import type { PresenterForce } from '../core/types'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { S } from '../strings'

// the presenter's hidden menu (long press on the logo): rig the next player round, then get out of the way.
// a tap outside closes it
export function PresenterPanel() {
  const open = useGame((s) => s.presenterOpen)
  const setOpen = useGame((s) => s.setPresenterOpen)
  if (!open) return null

  const pick = (kind: PresenterForce) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    runtime.engine.arm(kind)
    setOpen(false)
  }
  const close = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setOpen(false)
  }

  return (
    <div className="hud-presenter" onPointerDown={close}>
      <div className="presenter-panel">
        <button className="presenter-btn ck-chamfer" tabIndex={-1} onPointerDown={pick('warp')}>
          {S.presenterWarp}
        </button>
        <button className="presenter-btn presenter-btn--boom ck-chamfer" tabIndex={-1} onPointerDown={pick('instant')}>
          {S.presenterBoom}
        </button>
      </div>
    </div>
  )
}
