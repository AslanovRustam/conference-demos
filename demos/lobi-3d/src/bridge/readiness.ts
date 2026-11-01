// When to reveal a game. iframe `load` fires long before a three.js game has its assets and
// shaders ready, so: take clickable:ready if the game sends it, otherwise a canvas that has drawn
// a few frames. Either signal is followed by the game's revealDelayMs (some games announce ready
// or create their canvas while their own loader is still up). Never past the timeout.

export type ReadyReason = 'message' | 'probe' | 'timeout'

export interface Readiness {
  messageReady(): void
  loaded(probe: () => Promise<boolean>): void
  readonly result: Promise<ReadyReason>
  dispose(): void
}

/** waitForReady: the game reliably sends clickable:ready, so its canvas appearing proves nothing (its own loader draws too) */
export function createReadiness(opts: { timeoutMs: number; revealDelayMs: number; waitForReady?: boolean }): Readiness {
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
    messageReady() {
      if (opts.revealDelayMs > 0) timers.push(setTimeout(() => settle('message'), opts.revealDelayMs))
      else settle('message')
    },
    loaded(probe) {
      if (opts.waitForReady) return
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
