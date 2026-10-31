export const START_BALANCE = 10_000
export const DEFAULT_BET = 100
export const BET_LADDER = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
export const AUTO_LADDER = [1.5, 2, 3, 5, 10, 25, 50, 100]
export const DEFAULT_AUTO = 2
export const COUNTDOWN_S = 3

// multiplier curve: m = exp(MULT_RATE * t)
export const MULT_RATE = 0.1516
export const MAX_MULT = 1000

// [multiplier, survival probability]
export const CRASH_ANCHORS = [[1.01, 0.97], [2, 0.5], [5, 0.25], [15, 0.1], [50, 0.025], [1000, 0.0005]] as const
// a player round always flies at least this long before it can blow up: time to watch it and cash out
export const MIN_FLIGHT_S = 10

export const STAGE_THRESHOLDS = [1, 1.2, 1.8, 3, 8, 30] as const
export const ALT_ANCHORS_KM = [0, 0.4, 3.5, 40, 400, 20000, 400000]
export const VEL_ANCHORS_KMS = [0, 0.08, 0.45, 1.6, 7.8, 11.2, 99.9]

export const EJECT_TAIL_MAX_S = 6
export const CRASH_SCENE_S = 1.6
export const CRASH_SCENE_SHORT_S = 1.0
export const RESULT_S = 2.5
export const HISTORY_LEN = 15
export const IDLE_TO_ATTRACT_S = 45
export const WARP_FORCE_RANGE = [40, 150] as const
export const MAX_DT = 0.1
