export interface SafeStorage {
  get(key: string): string | null
  set(key: string, v: string): void
}

// localStorage can throw (private mode, blocked): never let it reach the game
export function createSafeStorage(get: () => Storage): SafeStorage {
  return {
    get(key) {
      try {
        return get().getItem(key)
      } catch {
        return null
      }
    },
    set(key, v) {
      try {
        get().setItem(key, v)
      } catch {
        // ignore
      }
    },
  }
}

export const safeStorage = createSafeStorage(() => localStorage)
