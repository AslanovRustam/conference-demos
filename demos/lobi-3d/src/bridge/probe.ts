// Fallback readiness check for games that never send clickable:ready. Works because the game
// iframe is same-origin: we can look for its canvas and count frames on its own clock.

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function probeCanvasFrames(iframe: HTMLIFrameElement, frames = 3, maxWaitMs = 4000): Promise<boolean> {
  const deadline = performance.now() + maxWaitMs
  try {
    let canvas: HTMLCanvasElement | null = null
    while (!canvas) {
      canvas = iframe.contentDocument?.querySelector('canvas') ?? null
      if (canvas) break
      if (performance.now() > deadline) return false
      await wait(100)
    }
    const win = iframe.contentWindow
    if (!win) return false
    for (let i = 0; i < frames; i++) await new Promise((r) => win.requestAnimationFrame(r))
    return true
  } catch {
    // cross-origin or a detached frame: no evidence either way, let the timeout decide
    return false
  }
}
