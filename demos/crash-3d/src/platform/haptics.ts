// a short buzz on cash out and on the explosion; android chrome only (ios safari has no vibration api)
type Vibrator = { vibrate?: (pattern: number | number[]) => boolean }

export function createVibrate(nav: Vibrator | undefined): (pattern: number | number[]) => void {
  return (pattern) => {
    try {
      nav?.vibrate?.(pattern)
    } catch {
      // blocked before a user gesture or by policy: the buzz is a nicety
    }
  }
}

export const vibrate = createVibrate(typeof navigator === 'undefined' ? undefined : (navigator as Vibrator))
