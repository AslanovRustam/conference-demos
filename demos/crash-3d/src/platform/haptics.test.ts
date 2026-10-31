import { expect, test } from 'vitest'
import { createVibrate } from './haptics'

test('vibrates through navigator.vibrate when the device has it', () => {
  const calls: unknown[] = []
  const vibrate = createVibrate({ vibrate: (p: number | number[]) => (calls.push(p), true) })
  vibrate(40)
  vibrate([60, 40, 120])
  expect(calls).toEqual([40, [60, 40, 120]])
})

test('does nothing without the api and never throws', () => {
  expect(() => createVibrate(undefined)(40)).not.toThrow()
  expect(() => createVibrate({})(40)).not.toThrow()
  const angry = createVibrate({
    vibrate: () => {
      throw new Error('blocked')
    },
  })
  expect(() => angry(40)).not.toThrow()
})

test('stays still while the gate is closed (the idle loop plays to nobody)', () => {
  const calls: unknown[] = []
  let open = false
  const vibrate = createVibrate({ vibrate: (p: number | number[]) => (calls.push(p), true) }, () => open)
  vibrate(40)
  expect(calls).toEqual([])
  open = true
  vibrate(40)
  expect(calls).toEqual([40])
})
