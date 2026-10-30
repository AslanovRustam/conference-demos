// render layers besides the default 0. the near effects are transparent and write no depth, so the clouds (a post
// pass that only knows the depth) would land on top of them; post/CloudsEffect.ts draws these layers once more on
// their own and puts the clouds behind them. their objects stay on layer 0 too, for the main pass and the reflection

// around the rocket: the plume (the capsule's motor and the fireball later). the clouds take their distance from the
// plume's axis
export const FX_NEAR_LAYER = 1

// on the pad: smoke and steam, the floodlight beams. only drawn on their own while the camera is under the deck,
// where they always stand in front of it; from inside or above, the deck is in front of them
export const FX_PAD_LAYER = 2
