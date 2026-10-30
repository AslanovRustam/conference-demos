import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { introPhase } from './timeline';

const LOBBY_START_DELAY = 0.6; // с: в лобби кристалл раскалывается сам, чуть погодя после показа

export interface IntroState {
  /** сцена загружена, первый кадр нарисован: можно звать к тапу */
  ready: boolean;
  /** время тапа (с), null — интро ещё ждёт */
  startedAt: number | null;
  /** лобби показало игру, а интро ещё не готово: стартуем, как только будет готово */
  visibleRequested: boolean;
  autoStartAt: number | null;
  setReady(): void;
  start(): void;
  lobbyVisible(): void;
  /** вызывается каждый кадр: запускает отложенный автостарт */
  tick(): void;
  phaseNow(): ReturnType<typeof introPhase>;
}

export function createIntroStore(now: () => number = () => performance.now() / 1000): StoreApi<IntroState> {
  return createStore<IntroState>((set, get) => ({
    ready: false,
    startedAt: null,
    visibleRequested: false,
    autoStartAt: null,
    setReady: () => {
      if (get().ready) return;
      set({ ready: true, autoStartAt: get().visibleRequested ? now() + LOBBY_START_DELAY : null });
    },
    start: () => {
      if (get().startedAt === null) set({ startedAt: now(), autoStartAt: null });
    },
    lobbyVisible: () => {
      if (get().startedAt !== null) return;
      if (get().ready) set({ autoStartAt: now() + LOBBY_START_DELAY });
      else set({ visibleRequested: true });
    },
    tick: () => {
      const at = get().autoStartAt;
      if (at !== null && now() >= at) get().start();
    },
    phaseNow: () => {
      const s = get().startedAt;
      return introPhase(s === null ? null : now() - s);
    },
  }));
}

// Отладка таймингов: ?introSpeed=0.25 замедляет интро, ?introAt=1.2 замирает на этой секунде после тапа
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const speed = Number(params.get('introSpeed')) || 1;
const freezeAt = params.has('introAt') ? Number(params.get('introAt')) : null;
export const introStore = createIntroStore(() => (performance.now() / 1000) * speed);
if (freezeAt !== null) {
  const base = introStore.getState().phaseNow;
  introStore.setState({ phaseNow: () => (introStore.getState().startedAt === null ? base() : introPhase(freezeAt)) });
}

export function useIntro<T>(selector: (s: IntroState) => T): T {
  return useStore(introStore, selector);
}
