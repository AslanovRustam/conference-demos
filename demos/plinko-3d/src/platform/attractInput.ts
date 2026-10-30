type Swallowable = { stopPropagation(): void; preventDefault(): void };

const CLICK_WINDOW_MS = 500;

/**
 * Ввод при attract-режиме: любое касание сбрасывает таймер простоя; первое касание в attract
 * возвращает в игру и поглощается вместе со своим click, чтобы само не бросило шарик.
 */
export function createAttractInput(deps: { isAttract(): boolean; exit(): void; poke(): void; now(): number }) {
  let swallowUntil = -1;
  const swallow = (e: Swallowable) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return {
    onPointerDown(e: Swallowable) {
      deps.poke();
      if (!deps.isAttract()) {
        swallowUntil = -1; // новое настоящее нажатие: старый «долг» по click больше не действует
        return;
      }
      deps.exit();
      swallow(e);
      swallowUntil = deps.now() + CLICK_WINDOW_MS;
    },
    onKeyDown(e: Swallowable) {
      deps.poke();
      if (!deps.isAttract()) return;
      deps.exit();
      swallow(e);
    },
    onClick(e: Swallowable) {
      if (deps.now() > swallowUntil) return;
      swallowUntil = -1;
      swallow(e);
    },
    // Время с заблокированным экраном не считается простоем
    onVisible(state: DocumentVisibilityState) {
      if (state === 'visible') deps.poke();
    },
  };
}
