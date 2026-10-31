import type { SafeStorage } from './storage'

const KEY = 'crash.ctxReload'

// a phone short on gpu memory can lose the webgl context: the canvas freezes for good. reload the page instead,
// once per session, so a phone that keeps losing it does not reload in a loop
export function reloadOnContextLoss(
  canvas: { addEventListener(type: string, fn: () => void): void; removeEventListener(type: string, fn: () => void): void },
  reload: () => void,
  storage: SafeStorage,
): () => void {
  const onLost = () => {
    if (storage.get(KEY)) return
    storage.set(KEY, '1')
    reload()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  return () => canvas.removeEventListener('webglcontextlost', onLost)
}
