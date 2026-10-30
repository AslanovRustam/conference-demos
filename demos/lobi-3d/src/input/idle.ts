// One-shot inactivity timer: fires once after `timeoutMs` without a poke, until started again.

export interface IdleTimer {
  start(): void
  poke(): void
  stop(): void
}

export function createIdleTimer(timeoutMs: number, onIdle: () => void): IdleTimer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  const arm = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      running = false
      timer = null
      onIdle()
    }, timeoutMs)
  }
  return {
    start() {
      running = true
      arm()
    },
    poke() {
      if (running) arm()
    },
    stop() {
      running = false
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
