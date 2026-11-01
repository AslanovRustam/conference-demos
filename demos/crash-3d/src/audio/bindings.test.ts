import { expect, test } from 'vitest'
import { Emitter } from '../core/events'
import { createSafeStorage } from '../platform/storage'
import { bindAudio, bindVisibility, loadMuted, saveMuted, type SfxApi } from './bindings'

function fakeSfx(calls: string[]): SfxApi {
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(args.length ? `${name}:${args.join(',')}` : name)
    }
  return {
    countdown: rec('countdown'),
    liftoff: rec('liftoff'),
    stage: rec('stage'),
    cashout: rec('cashout'),
    parachute: rec('parachute'),
    crash: rec('crash'),
    win: rec('win'),
    ui: rec('ui'),
  }
}

function fakeDocument() {
  const listeners = new Set<() => void>()
  const doc = {
    hidden: false,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    setHidden(h: boolean) {
      doc.hidden = h
      for (const fn of listeners) fn()
    },
  }
  return doc
}

test('maps game events to sounds', () => {
  const calls: string[] = []
  const emitter = new Emitter()
  bindAudio(emitter, fakeSfx(calls))
  emitter.emit({ type: 'countdown', n: 3 })
  emitter.emit({ type: 'liftoff' })
  emitter.emit({ type: 'cashout', multiplier: 2, payout: 200, stage: 1, auto: false })
  emitter.emit({ type: 'crash', multiplier: 5, cashedOut: true, stage: 3 })
  expect(calls).toEqual(['countdown:3', 'liftoff', 'cashout', 'parachute', 'win:200', 'crash:3,true'])
})

test('no parachute sound above stage 1', () => {
  const calls: string[] = []
  const emitter = new Emitter()
  bindAudio(emitter, fakeSfx(calls))
  emitter.emit({ type: 'cashout', multiplier: 4, payout: 400, stage: 2, auto: true })
  expect(calls).toEqual(['cashout', 'win:400'])
})

test('every new stage gets its whoosh, and unbinding stops all sounds', () => {
  const calls: string[] = []
  const emitter = new Emitter()
  const off = bindAudio(emitter, fakeSfx(calls))
  emitter.emit({ type: 'stage', stage: 2 })
  off()
  emitter.emit({ type: 'stage', stage: 3 })
  expect(calls).toEqual(['stage:2'])
})

test('after a cash out the rocket flying on out of frame makes no stage sounds, until the next round', () => {
  const calls: string[] = []
  const emitter = new Emitter()
  bindAudio(emitter, fakeSfx(calls))
  emitter.emit({ type: 'stage', stage: 1 })
  emitter.emit({ type: 'cashout', multiplier: 4, payout: 400, stage: 2, auto: false })
  emitter.emit({ type: 'stage', stage: 3 })
  emitter.emit({ type: 'stage', stage: 5 })
  emitter.emit({ type: 'betting' })
  emitter.emit({ type: 'launch', bet: 100 })
  emitter.emit({ type: 'stage', stage: 1 })
  expect(calls).toEqual(['stage:1', 'cashout', 'win:400', 'stage:1'])
})

test('muted state persists through safeStorage and defaults to unmuted when storage throws', () => {
  const mem = new Map<string, string>()
  const ok = createSafeStorage(() => ({ getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) }) as unknown as Storage)
  expect(loadMuted(ok)).toBe(false)
  saveMuted(ok, true)
  expect(loadMuted(ok)).toBe(true)
  const broken = createSafeStorage(() => {
    throw new Error('denied')
  })
  expect(loadMuted(broken)).toBe(false)
  expect(() => saveMuted(broken, true)).not.toThrow()
})

test('hidden tab suspends audio, returning resumes it unless muted', () => {
  const calls: string[] = []
  const doc = fakeDocument()
  let muted = false
  bindVisibility(
    doc as unknown as Parameters<typeof bindVisibility>[0],
    {
      suspend: async () => {
        calls.push('suspend')
      },
      resume: async () => {
        calls.push('resume')
      },
    },
    () => muted,
  )
  doc.setHidden(true)
  doc.setHidden(false)
  muted = true
  doc.setHidden(true)
  doc.setHidden(false)
  expect(calls).toEqual(['suspend', 'resume', 'suspend'])
})

test('a crash after the cash out is a distant thud: the player is already safe in the capsule', () => {
  const calls: string[] = []
  const emitter = new Emitter()
  bindAudio(emitter, fakeSfx(calls))
  emitter.emit({ type: 'crash', multiplier: 5, cashedOut: true, stage: 3 })
  emitter.emit({ type: 'crash', multiplier: 5, cashedOut: false, stage: 3 })
  expect(calls).toEqual(['crash:3,true', 'crash:3,false'])
})
