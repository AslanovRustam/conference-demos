// Громкость фоновой музыки: в 2 раза тише первой версии (просьба заказчика)
export const MUSIC_VOLUME = 0.175;

export interface AudioEngine {
  readonly ctx: AudioContext | null;
  readonly sfx: GainNode | null;
  readonly music: GainNode | null;
  unlock(): Promise<void>;
  setMuted(m: boolean): void;
}

type Suspendable = { state: string; suspend(): Promise<void>; resume(): Promise<void> };
type VisibilityDoc = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;

/** Телефон заблокирован или вкладка скрыта: звук на паузе, при возвращении снова играет (если не выключен). */
export function bindVisibility(ctx: Suspendable, doc: VisibilityDoc, isMuted: () => boolean): () => void {
  const onChange = () => {
    if (doc.visibilityState === 'hidden') void ctx.suspend();
    else if (!isMuted()) void ctx.resume();
  };
  doc.addEventListener('visibilitychange', onChange);
  return () => doc.removeEventListener('visibilitychange', onChange);
}

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  let muted = false;

  return {
    get ctx() {
      return ctx;
    },
    get sfx() {
      return sfx;
    },
    get music() {
      return music;
    },
    async unlock() {
      if (!ctx) {
        // Контекст создаётся только по жесту пользователя: иначе мобильные браузеры его не запустят
        ctx = new AudioContext({ latencyHint: 'interactive' });
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 4;
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 1;
        sfx = ctx.createGain();
        sfx.gain.value = 0.9;
        music = ctx.createGain();
        music.gain.value = MUSIC_VOLUME;
        sfx.connect(master);
        music.connect(master);
        master.connect(compressor).connect(ctx.destination);
        bindVisibility(ctx, document, () => muted);
        // iOS: короткий беззвучный буфер окончательно «разблокирует» вывод звука
        const silent = ctx.createBufferSource();
        silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        silent.connect(ctx.destination);
        silent.start();
      }
      if (ctx.state !== 'running' && !muted) await ctx.resume().catch(() => undefined);
    },
    setMuted(m) {
      muted = m;
      if (!ctx || !master) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
      if (!m && ctx.state !== 'running' && document.visibilityState === 'visible') void ctx.resume();
    },
  };
}
