export type Risk = 'low' | 'medium' | 'high';
export type Rows = 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export const ROWS_MIN = 8;
export const ROWS_MAX = 16;
export const ROWS_LIST: readonly Rows[] = [8, 9, 10, 11, 12, 13, 14, 15, 16];
export const RISKS: readonly Risk[] = ['low', 'medium', 'high'];

export type BallKind = 'player' | 'rain' | 'demo';
export type RainMode = 'paid' | 'free' | 'demo';
export type CelebrateKind = 'big' | 'mega' | 'total';
export type Quality = 'high' | 'light';
