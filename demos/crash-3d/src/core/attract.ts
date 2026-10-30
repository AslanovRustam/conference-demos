// the stand's idle loop: a warp with a late cash out, a crash, a deep warp, a quick win, an early cash out
export const ATTRACT_SCRIPT: { crash: number; autoAt: number | null }[] = [
  { crash: 64, autoAt: 12 },
  { crash: 3.4, autoAt: null },
  { crash: 140, autoAt: 35 },
  { crash: 9, autoAt: 4 },
  { crash: 1.6, autoAt: 1.3 },
]

export function attractRound(i: number): { crash: number; autoAt: number | null } {
  const n = ATTRACT_SCRIPT.length
  return ATTRACT_SCRIPT[((i % n) + n) % n]
}
