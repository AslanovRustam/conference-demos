import type { Risk, Rows } from './core/types';

export const START_BALANCE = 10_000;
export const BETS = [10, 20, 50, 100, 200, 500, 1000] as const;
export const DEFAULT_BET = 100;
export const DEFAULT_RISK: Risk = 'high';
export const DEFAULT_ROWS: Rows = 12;

export const RAIN_COUNT = 100;
export const RAIN_SPAWN_INTERVAL = 0.06; // с между шариками дождя
export const MAX_ACTIVE_BALLS = 130;
export const MAX_DT = 0.05; // с, защита от скачка времени после скрытой вкладки
export const MAX_QUEUED_DROPS = 5;
export const BIG_WIN_EVERY = 5; // каждый 5-й бросок игрока заканчивается BIG или MEGA WIN
export const QUEUE_STAGGER = 0.15; // с между отложенными бросками, чтобы шарики не слипались

export const IDLE_MS = 45_000;
export const HISTORY_MAX = 12;

export const SLOWMO_SCALE = 0.3;
export const SLOWMO_ROWS_BEFORE_END = 3;
export const DECOY_CHANCE = 0.5;

export const PRESENTER_LONGPRESS_MS = 2000;

export const ATTRACT_DROP_INTERVAL = 2.2;
export const ATTRACT_SHOWCASE_INTERVAL = 20;
export const ATTRACT_RAIN_COUNT = 60;
