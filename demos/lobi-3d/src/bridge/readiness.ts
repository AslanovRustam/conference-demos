// When to reveal a game. iframe `load` fires long before a three.js game has its assets and
// shaders ready, so: trust clickable:ready if the game sends it; otherwise wait for a canvas
// that has drawn a few frames (+ the game's revealDelayMs); never keep the visitor waiting
// past the timeout.

export type ReadyReason = 'message' | 'probe' | 'timeout'

export interface Readiness {
  messageReady(): void
  loaded(probe: () => Promise<boolean>): void
  readonly result: Promise<ReadyReason>
  dispose(): void
}

export function createReadiness(opts: { timeoutMs: number; revealDelayMs: number }): Readiness {
  let settle!: (reason: ReadyReason) => void
  let settled = false
  let disposed = false
  const timers: ReturnType<typeof setTimeout>[] = []

  const result = new Promise<ReadyReason>((resolve) => {
    settle = (reason) => {
      if (settled || disposed) return
      settled = true
      timers.forEach(clearTimeout)
      resolve(reason)
    }
  })

  timers.push(setTimeout(() => settle('timeout'), opts.timeoutMs))

  return {
    result,
    messageReady: () => settle('message'),
    loaded(probe) {
      probe().then(
        (ok) => {
          if (ok && !settled && !disposed) timers.push(setTimeout(() => settle('probe'), opts.revealDelayMs))
        },
        () => {},
      )
    },
    dispose() {
      disposed = true
      timers.forEach(clearTimeout)
    },
  }
}
