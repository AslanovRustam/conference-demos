// a short buzz on cash out and on the explosion; android chrome only (ios safari has no vibration api)
type Vibrator = { vibrate?: (pattern: number | number[]) => boolean }

// allowed: closed while the stand plays its idle loop (an idle phone must not buzz every round)
export function createVibrate(nav: Vibrator | undefined, allowed: () => boolean = () => true): (pattern: number | number[]) => void {
  return (pattern) => {
    if (!allowed()) return
    try {
      nav?.vibrate?.(pattern)
    } catch {
      // blocked before a user gesture or by policy: the buzz is a nicety
    }
  }
}

let gate = () => true

// the app closes the gate while the idle loop runs
export function gateVibrate(fn: () => boolean): void {
  gate = fn
}

export const vibrate = createVibrate(typeof navigator === 'undefined' ? undefined : (navigator as Vibrator), () => gate())
