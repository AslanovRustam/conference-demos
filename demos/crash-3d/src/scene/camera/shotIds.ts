// the broadcast cameras by name; kept apart from shots.ts so params can validate ?shot= without loading three
export const SHOT_IDS = ['padWide', 'padClose', 'groundTele', 'onboard', 'sideChase', 'wide', 'capsuleFollow', 'crashWide'] as const
export type ShotId = (typeof SHOT_IDS)[number]
