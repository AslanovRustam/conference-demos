// fires onIdle once after ms without a poke; the next poke re-arms it
export function createIdleTimer(
  ms: number,
  onIdle: () => void,
  now: () => number = () => performance.now(),
): { poke(): void; tick(): void; dispose(): void } {
  let last = now()
  let fired = false
  let disposed = false
  return {
    poke() {
      last = now()
      fired = false
    },
    tick() {
      if (disposed || fired || now() - last < ms) return
      fired = true
      onIdle()
    },
    dispose() {
      disposed = true
    },
  }
}
