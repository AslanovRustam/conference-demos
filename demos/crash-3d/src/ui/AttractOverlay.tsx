import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { S } from '../strings'

// the idle loop's call to action. while attract runs a transparent layer takes every touch, so the touch that wakes
// the game (App's window listener) never reaches a button under it; leaving attract dips from black
export function AttractOverlay() {
  const attract = useGame((s) => s.snap.attract)
  const was = useRef(attract)
  const [dip, setDip] = useState(0)

  useEffect(() => {
    if (was.current && !attract) setDip((d) => d + 1)
    was.current = attract
  }, [attract])

  return (
    <>
      {attract && (
        <div className="hud-attract">
          <span className="attract-cta attract-cta--keys">{S.pressToLaunch}</span>
          <span className="attract-cta attract-cta--touch">{S.tapToLaunch}</span>
        </div>
      )}
      {dip > 0 && <div key={dip} className="hud-dip" aria-hidden />}
    </>
  )
}
