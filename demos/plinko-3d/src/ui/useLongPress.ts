import { useEffect, useRef } from 'react';
import { PRESENTER_LONGPRESS_MS } from '../config';

/** Долгое нажатие мышью или пальцем. Обычный короткий тап ничего не делает. */
export function useLongPress(onLongPress: () => void, ms = PRESENTER_LONGPRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onLongPress);
  cb.current = onLongPress;

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cancel();
      timer.current = setTimeout(() => cb.current(), ms);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
