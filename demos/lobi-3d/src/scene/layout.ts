// Scene dimensions in metres. Starting values; tuned by eye against the approved mockup.

export const RADIUS = 4.2

export const CABINET = { w: 1.3, h: 2.3, d: 0.9 } as const

/** 16:9 like the 1920×1080 base resolution, so the fly-in ends on an exact fit. */
export const SCREEN = { w: 1.1, h: 0.61875, y: 1.5 } as const

export const FOV_HOME = 36
export const FOV_PLAY = 32

export const CAMERA_HOME = {
  position: [0, 2.5, RADIUS + 7.6] as [number, number, number],
  target: [0, 1.25, 1.2] as [number, number, number],
}

/** glass sphere with the glowing Clickable mark, above the middle of the ring */
export const CORE = { y: 3.6, radius: 0.85 } as const

/** how strongly cabinets beside the front one turn toward the viewer (0 = face straight out) */
export const TURN_TO_VIEWER = 0.55
