import type { PointerEvent } from 'react'
import { exitToLobby } from '../platform/embed'
import { params } from '../platform/params'
import { S } from '../strings'

// back to the lobby (?embed=1 only); Esc does the same
export function ExitButton() {
  if (!params.embed) return null
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    exitToLobby()
  }
  return (
    <button className="hud-exit ck-chamfer" tabIndex={-1} onPointerDown={onDown}>
      {S.exit}
    </button>
  )
}
