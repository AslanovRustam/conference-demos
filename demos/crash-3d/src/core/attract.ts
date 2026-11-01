// the stand's idle loop: a warp with a late cash out, a crash in space, a deep warp, a quick win, a cash out just
// before the blast. like a player round, none blows up before the minimum flight (crashPoint.ts MIN_CRASH)
export const ATTRACT_SCRIPT: { crash: number; autoAt: number | null }[] = [
  { crash: 64, autoAt: 12 },
  { crash: 6.5, autoAt: null },
  { crash: 140, autoAt: 35 },
  { crash: 9, autoAt: 4 },
  { crash: 5.2, autoAt: 4.8 },
]

export function attractRound(i: number): { crash: number; autoAt: number | null } {
  const n = ATTRACT_SCRIPT.length
  return ATTRACT_SCRIPT[((i % n) + n) % n]
}
