export interface KeyHandlers {
  primary(): void
  bet(dir: 1 | -1): void
  auto(dir: 1 | -1): void
  toggleAuto(): void
  mute(): void
  exit(): void
  anyInput(): void
  code(key: string): void
}

export function bindKeyboard(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  h: KeyHandlers,
): () => void {
  const onKey = (e: KeyboardEvent) => {
    // held keys must not re-fire actions
    if (e.repeat) return
    h.anyInput()
    switch (e.code) {
      case 'Space':
      case 'Enter':
        e.preventDefault()
        h.primary()
        return
      case 'ArrowUp':
        e.preventDefault()
        h.bet(1)
        return
      case 'ArrowDown':
        e.preventDefault()
        h.bet(-1)
        return
      case 'ArrowRight':
        e.preventDefault()
        h.auto(1)
        return
      case 'ArrowLeft':
        e.preventDefault()
        h.auto(-1)
        return
      case 'KeyA':
        h.toggleAuto()
        break
      case 'KeyM':
        h.mute()
        break
      case 'Escape':
        h.exit()
        return
    }
    if (typeof e.key === 'string' && /^[a-zA-Z]$/.test(e.key)) h.code(e.key.toUpperCase())
  }
  target.addEventListener('keydown', onKey)
  return () => target.removeEventListener('keydown', onKey)
}
