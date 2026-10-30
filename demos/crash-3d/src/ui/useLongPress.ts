import type { PointerEvent } from 'react'
import { useEffect, useMemo, useRef } from 'react'

// fires onLong when a press is held for ms; letting go or a new press resets it
export function createPressTimer(ms: number, onLong: () => void): { down(): void; up(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const up = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return {
    down() {
      up()
      timer = setTimeout(() => {
        timer = null
        onLong()
      }, ms)
    },
    up,
  }
}

// pointer handlers for a press-and-hold target (the presenter's hidden door on the logo)
export function useLongPress(ms: number, onLong: () => void) {
  const latest = useRef(onLong)
  useEffect(() => {
    latest.current = onLong
  })
  const press = useMemo(() => createPressTimer(ms, () => latest.current()), [ms])
  useEffect(() => press.up, [press])
  return useMemo(
    () => ({
      onPointerDown: (e: PointerEvent) => {
        if (e.button === 0) press.down()
      },
      onPointerUp: press.up,
      onPointerLeave: press.up,
      onPointerCancel: press.up,
      // no image callout or text selection on a held finger
      onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
    }),
    [press],
  )
}
