// typed codes (WARP / BOOM) must be finished within windowMs
export function createCodeDetector(
  codes: Record<string, () => void>,
  windowMs = 2000,
): (key: string, now: number) => void {
  const maxLen = Math.max(0, ...Object.keys(codes).map((c) => c.length))
  let buf: Array<{ k: string; t: number }> = []
  return (key, now) => {
    buf.push({ k: key, t: now })
    if (buf.length > maxLen) buf = buf.slice(buf.length - maxLen)
    for (const [code, fn] of Object.entries(codes)) {
      if (buf.length < code.length) continue
      const tail = buf.slice(buf.length - code.length)
      if (tail.map((e) => e.k).join('') === code && now - tail[0].t <= windowMs) {
        buf = []
        fn()
        return
      }
    }
  }
}
