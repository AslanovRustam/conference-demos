export interface KeyHandlers {
  primary(): void
  bet(dir: 1 | -1): void
  auto(dir: 1 | -1): void
  toggleAuto(): void
  mute(): void
  exit(): void
  // true when the key only woke the game (attract): no action then, codes still count
  anyInput(): boolean | void
  code(key: string): void
}

const SCROLL_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function bindKeyboard(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  h: KeyHandlers,
): () => void {
  const act = (code: string) => {
    switch (code) {
      case 'Space':
      case 'Enter':
        h.primary()
        return
      case 'ArrowUp':
        h.bet(1)
        return
      case 'ArrowDown':
        h.bet(-1)
        return
      case 'ArrowRight':
        h.auto(1)
        return
      case 'ArrowLeft':
        h.auto(-1)
        return
      case 'KeyA':
        h.toggleAuto()
        return
      case 'KeyM':
        h.mute()
        return
      case 'Escape':
        h.exit()
        return
    }
  }
  const onKey = (e: KeyboardEvent) => {
    // held keys must not re-fire actions; ctrl / meta / alt combos belong to the browser
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    // no page scroll, no click on a focused button
    if (SCROLL_KEYS.has(e.code)) e.preventDefault()
    // a key that only woke the game does nothing else; Escape (back to the lobby) is safe in every phase
    if (h.anyInput() !== true || e.code === 'Escape') act(e.code)
    // letters by physical key, so codes work on any layout
    const letter = /^Key([A-Z])$/.exec(e.code)
    if (letter) h.code(letter[1])
  }
  target.addEventListener('keydown', onKey)
  return () => target.removeEventListener('keydown', onKey)
}
