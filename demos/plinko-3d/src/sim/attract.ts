import type { StoreApi } from 'zustand/vanilla';
import { ATTRACT_DROP_INTERVAL, ATTRACT_RAIN_COUNT, ATTRACT_SHOWCASE_INTERVAL, MAX_DT } from '../config';
import type { GameState } from '../state/store';
import type { GameController } from './controller';

const FIRST_SHOWCASE = 8; // первый эффектный момент не ждёт полных 20 секунд

/** Сам играет, пока устройство лежит без дела: демо-шарики, Big Win и дождь, баланс не трогает. */
export class AttractDirector {
  private dropTimer = 0;
  private showcaseTimer = FIRST_SHOWCASE;
  private next: 'big' | 'rain' = 'big';

  constructor(private readonly deps: { store: StoreApi<GameState>; controller: GameController }) {}

  update(realDt: number): void {
    const { store, controller } = this.deps;
    if (store.getState().mode !== 'attract') {
      this.dropTimer = 0.5;
      this.showcaseTimer = FIRST_SHOWCASE;
      return;
    }
    if (controller.celebrating || controller.rainActive) return;
    const dt = Math.min(realDt, MAX_DT);
    this.showcaseTimer -= dt;

    if (this.showcaseTimer <= 0) {
      if (this.next === 'rain') {
        controller.rain({ mode: 'demo', count: ATTRACT_RAIN_COUNT });
      } else {
        // Крупный выигрыш показываем на пустом поле: тогда сработает и замедление.
        // Если бросок сейчас не прошёл (например, доигрывает замедление), повторяем в следующем кадре.
        if (store.getState().inFlight > 0) return;
        if (!controller.drop({ kind: 'demo', forceBig: true })) return;
      }
      this.next = this.next === 'big' ? 'rain' : 'big';
      this.showcaseTimer = ATTRACT_SHOWCASE_INTERVAL;
      return;
    }

    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = ATTRACT_DROP_INTERVAL;
      controller.drop({ kind: 'demo' });
    }
  }
}
