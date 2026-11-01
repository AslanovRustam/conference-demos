import { GRID_H, GRID_W } from '../GridView'

/** vault room layout in world units: the wall is the plane z = 0, the opening is centred on the origin */
export const VAULT = {
  /** radius of the round opening (inside of the frame tunnel) */
  opening: 4.62,
  /** outer radius of the steel frame round the opening */
  frameOuter: 5.75,
  /** the frame's front lip sticks out this far from the wall */
  frameLip: 0.3,
  /** depth of the tunnel through the wall */
  tunnel: 1.9,
  floorY: -6.1,
  /** the reels sit inside the vault, behind the doorway */
  gridY: -0.05,
  gridZ: -2.7,
  bezelW: GRID_W + 1.1,
  bezelH: GRID_H + 1.1,
  /** the bezel's front face sits this far in front of the symbols (group 0.62 + depth 0.26 + bevel 0.05) */
  bezelFrontZ: 0.93,
  /** half-height of the bezel's opening: hole GRID_H / 2 + 0.11 narrowed by its 0.05 bevel */
  bezelInnerHalfH: GRID_H / 2 + 0.06,
  /** inside of the vault */
  roomW: 15,
  roomDepth: 11,
  roomHeight: 11,
}

/** animated by the stage, read by the room every frame: how much warm light pours out of the vault (0..1) */
export const vaultLight = { interior: 0 }
