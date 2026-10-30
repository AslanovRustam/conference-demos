import type { Quality } from '../core/types';

const WEAK_GPU = /SwiftShader|llvmpipe|Mali-[4T]|Adreno \(TM\) [3-5]\d\d/i;

/** Стартовый уровень качества: телефоны и слабые GPU начинают с облегчённого. */
export function initialQuality(env: { coarsePointer: boolean; maxTouchPoints: number; renderer?: string; override?: string | null }): Quality {
  if (env.override === 'high' || env.override === 'light') return env.override;
  if (env.coarsePointer || env.maxTouchPoints > 0) return 'light';
  if (env.renderer && WEAK_GPU.test(env.renderer)) return 'light';
  return 'high';
}

export function dprRange(q: Quality): [number, number] {
  return q === 'high' ? [1, 2] : [1, 1.5];
}

/** Имя GPU для эвристики; null, если браузер его не раскрывает. */
export function readRenderer(): string | undefined {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : undefined;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

export function detectQuality(): Quality {
  return initialQuality({
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    renderer: readRenderer(),
    override: new URLSearchParams(location.search).get('quality'),
  });
}
