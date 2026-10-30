// Scene dimensions in metres. Starting values; tuned by eye against the approved mockup.

export const RADIUS = 4.2

export const CABINET = { w: 1.3, h: 2.3, d: 0.9 } as const

/** 16:9 like the 1920×1080 base resolution, so the fly-in ends on an exact fit. */
export const SCREEN = { w: 1.0, h: 0.5625, y: 1.45 } as const

export const FOV_HOME = 40
export const FOV_PLAY = 32

export const CAMERA_HOME = {
  position: [0, 2.1, RADIUS + 5.4] as [number, number, number],
  target: [0, 1.6, RADIUS * 0.4] as [number, number, number],
}

export const LOGO = { y: 3.7, width: 3.4 } as const
