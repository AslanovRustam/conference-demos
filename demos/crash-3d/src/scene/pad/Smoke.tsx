import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color, Mesh, Vector3, type InstancedInterleavedBuffer } from 'three'
import { createRng, type Rng } from '../../core/rng'
import type { Phase } from '../../core/types'
import { useGame } from '../../game/store'
import { FX_PAD_LAYER } from '../layers'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { hullRadiusAt } from '../rocket/geometry'
import { plumeLight } from '../rocket/Plume'
import { exhaustRate, launchClock, steamLevel, thrustAt } from './emission'
import { ACTIVE_FLOODS } from './Floodlights'
import {
  ARMS,
  armTip,
  DECK_HOLE_R,
  DECK_VENTS,
  floodPos,
  GROUND_Y,
  HIDE_ALT_M,
  ROCKET_VENTS,
  TRENCH_EXIT,
  TRENCH_FLOOR_Y,
  TRENCH_HALF_W,
} from './layout'
import { PUFF_STRIDE, puffGeometry, smokeMaterial, smokeNoiseTexture } from './smokeShader'

// steam and exhaust clouds of the pad. puffs live in pad space and keep billowing where they were born while the
// rocket climbs away. steam from the valves while waiting, harder through the countdown; at ignition the exhaust
// bursts out from under the mount and the flame trench exits, hot and glowing at first, lit orange by the flame and
// cold by the floodlights. a page that opens mid-launch replays the last seconds from the launch clock

const TAU = Math.PI * 2
const EXHAUST_PEAK = 2600 // puffs per second at full thrust on the deck
const EXHAUST_PREWARM = 14 // seconds of exhaust history replayed on a jump
const STEAM_PREWARM = 5
const REPLAY_STEP = 1 / 120
const FLAME_COLOR = new Color(1, 0.66, 0.38)
const ON_PAD_M = 0.5 // rocket vents breathe only while the rocket stands on the pad
// steam puffs per second at the idle level (steamLevel): per rocket vent, per deck valve, trench mist, apron haze
// (the haze does not follow the level)
const VENT_RATE = 28
const VALVE_RATE = 4
const MIST_RATE = 7
const HAZE_RATE = 3.5
const DISCONNECT_PUFFS = 36

// a ring buffer over a slice of the puff buffer; writes are uploaded once per frame
class Pool {
  readonly start: number
  readonly size: number
  private readonly data: Float32Array
  private cursor = 0
  private first = 0
  private written = 0

  constructor(buffer: InstancedInterleavedBuffer, start: number, size: number) {
    this.start = start
    this.size = size
    this.data = buffer.array as Float32Array
  }

  push(p: Float32Array): void {
    if (this.written === 0) this.first = this.cursor
    this.data.set(p, (this.start + this.cursor) * PUFF_STRIDE)
    this.cursor = (this.cursor + 1) % this.size
    this.written++
  }

  flush(buffer: InstancedInterleavedBuffer): boolean {
    if (this.written === 0) return false
    const n = Math.min(this.written, this.size)
    if (n === this.size) buffer.addUpdateRange(this.start * PUFF_STRIDE, this.size * PUFF_STRIDE)
    else if (this.first + n <= this.size) buffer.addUpdateRange((this.start + this.first) * PUFF_STRIDE, n * PUFF_STRIDE)
    else {
      buffer.addUpdateRange((this.start + this.first) * PUFF_STRIDE, (this.size - this.first) * PUFF_STRIDE)
      buffer.addUpdateRange(this.start * PUFF_STRIDE, (n - (this.size - this.first)) * PUFF_STRIDE)
    }
    this.written = 0
    return true
  }
}

// one puff into the scratch record
function puff(
  out: Float32Array,
  pos: [number, number, number],
  vel: [number, number, number],
  birth: number,
  life: number,
  size: [number, number],
  heat: number,
  seed: number,
  drag: number,
  rise: number,
  spin: number,
  alpha: number,
): Float32Array {
  out[0] = pos[0]
  out[1] = pos[1]
  out[2] = pos[2]
  out[3] = birth
  out[4] = vel[0]
  out[5] = vel[1]
  out[6] = vel[2]
  out[7] = life
  out[8] = size[0]
  out[9] = size[1]
  out[10] = heat
  out[11] = seed
  out[12] = drag
  out[13] = rise
  out[14] = spin
  out[15] = alpha
  return out
}

// ---------- emitters ----------

// exhaust at one moment of the launch: out from under the mount, along the trench and out of its exits,
// and the deluge water flashing to steam on the deck
function exhaust(r: Rng, out: Float32Array, birth: number, thrust: number): Float32Array {
  const pick = r()
  const seed = r()
  const spin = (r() - 0.5) * 0.3
  if (pick < 0.4) {
    const a = r() * TAU
    const rad = 2 + r() * 3
    const sp = 26 + r() * 34
    return puff(
      out,
      [Math.cos(a) * rad, GROUND_Y + 1.5 + r() * 2.5, Math.sin(a) * rad],
      [Math.cos(a) * sp, 1 + r() * 5, Math.sin(a) * sp],
      birth, 8 + r() * 6, [5 + r() * 3, 22 + r() * 18], (0.6 + 0.4 * r()) * thrust, seed, 0.8 + r() * 0.5, 1.6 + r() * 2, spin, 0.45 + 0.2 * r(),
    )
  }
  if (pick < 0.86) {
    const side = r() < 0.5 ? -1 : 1
    const sp = 34 + r() * 36
    return puff(
      out,
      [(r() - 0.5) * 2 * (TRENCH_HALF_W - 1.5), GROUND_Y + 0.8 + r(), side * (TRENCH_EXIT - 3 - r() * 5)],
      [(r() - 0.5) * 14, 6 + r() * 12, side * sp],
      birth, 10 + r() * 6, [6 + r() * 3, 30 + r() * 24], (0.5 + 0.4 * r()) * thrust, seed, 0.7 + r() * 0.35, 2.2 + r() * 2.4, spin, 0.45 + 0.2 * r(),
    )
  }
  const a = r() * TAU
  const rad = DECK_HOLE_R + r() * 3
  const sp = 10 + r() * 14
  return puff(
    out,
    [Math.cos(a) * rad, 0.8 + r(), Math.sin(a) * rad],
    [Math.cos(a) * sp, 1.5 + r() * 3, Math.sin(a) * sp],
    birth, 5 + r() * 3, [3, 14 + r() * 9], 0.25 * thrust, seed, 1.2, 1 + r() * 1.2, spin, 0.32,
  )
}

// lox boil-off from a vent on the hull: pushed out, then sinking down the side of the rocket
function rocketVent(r: Rng, out: Float32Array, birth: number, v: (typeof ROCKET_VENTS)[number]): Float32Array {
  const rad = hullRadiusAt(v.y) + 0.1
  const ox = Math.sin(v.az)
  const oz = Math.cos(v.az)
  const sp = 5 + r() * 3
  const t = (r() - 0.5) * 1.2
  return puff(
    out,
    [ox * rad, rig.altM + v.y, oz * rad],
    [ox * sp + oz * t, -0.5 + r() * 0.6, oz * sp - ox * t],
    birth, 4.5 + r() * 2.5, [0.3 + r() * 0.3, 3.5 + r() * 2.5], 0, r(), 1.6, -1.6, (r() - 0.5) * 0.8, 0.08 + 0.06 * r(),
  )
}

// valves on the deck and the tower puff upwards
function deckVent(r: Rng, out: Float32Array, birth: number, v: [number, number, number]): Float32Array {
  return puff(
    out,
    [v[0] + (r() - 0.5) * 0.4, v[1], v[2] + (r() - 0.5) * 0.4],
    [(r() - 0.5) * 1.2, 3 + r() * 3, (r() - 0.5) * 1.2],
    birth, 3 + r() * 2, [0.5, 4 + r() * 3], 0, r(), 1.1, 0.9, (r() - 0.5) * 0.6, 0.1 + 0.06 * r(),
  )
}

// mist breathing out of the wet flame trench
function trenchMist(r: Rng, out: Float32Array, birth: number): Float32Array {
  return puff(
    out,
    [(r() - 0.5) * 2 * TRENCH_HALF_W, GROUND_Y - 1.5, (r() - 0.5) * 2 * (TRENCH_EXIT - 6)],
    [(r() - 0.5) * 0.6, 1 + r(), (r() - 0.5) * 0.6],
    birth, 5 + r() * 3, [3, 9 + r() * 5], 0, r(), 0.6, 0.5, (r() - 0.5) * 0.2, 0.1 + 0.08 * r(),
  )
}

// low haze over the apron, lit where the floodlights cross it
function haze(r: Rng, out: Float32Array, birth: number): Float32Array {
  const a = r() * TAU
  const rad = 18 + r() * 80
  return puff(
    out,
    [Math.cos(a) * rad, GROUND_Y + 0.5 + r() * 3, Math.sin(a) * rad],
    [(r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6],
    birth, 12 + r() * 6, [14, 32 + r() * 16], 0, r(), 0.3, 0.1, (r() - 0.5) * 0.1, 0.025 + 0.025 * r(),
  )
}

// vapor from a hose letting go as an arm swings away
function disconnect(r: Rng, out: Float32Array, birth: number, at: Vector3): Float32Array {
  const a = r() * TAU
  const sp = 2 + r() * 4
  return puff(
    out,
    [at.x + (r() - 0.5), at.y + (r() - 0.5), at.z + (r() - 0.5)],
    [Math.cos(a) * sp, -1 - r() * 2, Math.sin(a) * sp],
    birth, 3 + r() * 1.5, [0.5, 4 + r() * 3], 0, r(), 1.6, -0.6, (r() - 0.5) * 0.6, 0.14 + 0.08 * r(),
  )
}

interface State {
  started: boolean
  lastTime: number
  lastPhase: Phase | null
  lastAge: number
  lastL: number | null
  exhaustAcc: number
  steamAcc: number[]
}

export function Smoke() {
  const built = useMemo(() => {
    const cap = QUALITY.smokeParticles
    const { geometry, buffer } = puffGeometry(cap)
    const noise = smokeNoiseTexture()
    const material = smokeMaterial(ACTIVE_FLOODS.length, noise)
    const mesh = new Mesh(geometry, material)
    mesh.name = 'smoke'
    // puffs move in the vertex shader: the geometry bounds know nothing of them
    mesh.frustumCulled = false
    // after the beams (they shine through thin smoke), before the plume (the flame glows through the clouds)
    mesh.renderOrder = -1
    // drawn once more by the clouds pass while the camera is under the deck, so the deck stays behind it
    mesh.layers.enable(FX_PAD_LAYER)
    const steamN = Math.round(cap * QUALITY.steamShare)
    return {
      mesh,
      geometry,
      material,
      noise,
      buffer,
      steam: new Pool(buffer, 0, steamN),
      exhaust: new Pool(buffer, steamN, cap - steamN),
      tips: ARMS.map(armTip),
      floods: ACTIVE_FLOODS.map((f) => {
        const pos = floodPos(f)
        return {
          pos,
          dir: new Vector3(...f.aim).sub(pos).normalize(),
          col: new Color(...f.color).multiplyScalar(f.cd),
          cone: [Math.cos(f.angle), Math.cos(f.angle * (1 - f.penumbra))] as const,
        }
      }),
    }
  }, [])

  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
      built.noise.dispose()
    },
    [built],
  )

  const sim = useMemo(() => {
    const st: State = { started: false, lastTime: 0, lastPhase: null, lastAge: 0, lastL: null, exhaustAcc: 0, steamAcc: [0, 0, 0, 0] }
    return { st, rng: createRng(0x5e0c), scratch: new Float32Array(PUFF_STRIDE), rates: [0, 0, 0, 0] }
  }, [])

  useEffect(() => {
    const u = built.material.uniforms
    u.uGround.value = GROUND_Y
    built.floods.forEach((f, i) => {
      u.uFloodPos.value[i].copy(f.pos)
      u.uFloodDir.value[i].copy(f.dir)
      u.uFloodCone.value[i].set(f.cone[0], f.cone[1])
    })
  }, [built])

  useFrame(() => {
    const { st, rng: r, scratch, rates } = sim
    const { steam, exhaust: ex, mesh, material, buffer } = built
    const u = material.uniforms
    const snap = useGame.getState().snap
    const now = rig.vtime
    const dt = st.started ? Math.max(0, now - st.lastTime) : 0
    const on = rig.altM <= HIDE_ALT_M
    mesh.visible = on

    // the round is over: its exhaust thins away during the result, so the next round starts on a clear pad
    // (an abort straight back to betting cuts it too)
    const entered = st.lastPhase !== null && st.lastPhase !== snap.phase
    if (entered && (snap.phase === 'result' || (snap.phase === 'betting' && st.lastPhase !== 'result'))) u.uCut.value = now

    // steam: valves on the rocket and the pad, mist from the trench, haze over the apron
    const span = st.started ? dt : STEAM_PREWARM
    const level = steamLevel(snap.phase, snap.phaseAge)
    const onPad = rig.altM < ON_PAD_M
    rates[0] = onPad ? VENT_RATE * level * ROCKET_VENTS.length : 0
    rates[1] = VALVE_RATE * level * DECK_VENTS.length
    rates[2] = MIST_RATE * level
    rates[3] = HAZE_RATE
    for (let k = 0; k < rates.length; k++) {
      st.steamAcc[k] += rates[k] * span
      while (st.steamAcc[k] >= 1) {
        st.steamAcc[k]--
        const birth = now - r() * span
        if (k === 0) steam.push(rocketVent(r, scratch, birth, ROCKET_VENTS[Math.floor(r() * ROCKET_VENTS.length)]))
        else if (k === 1) steam.push(deckVent(r, scratch, birth, DECK_VENTS[Math.floor(r() * DECK_VENTS.length)]))
        else if (k === 2) steam.push(trenchMist(r, scratch, birth))
        else steam.push(haze(r, scratch, birth))
      }
    }
    // hoses letting go as the arms swing away
    if (snap.phase === 'countdown' && st.started) {
      const from = st.lastPhase === 'countdown' ? st.lastAge : -1
      ARMS.forEach((a, i) => {
        if (from < a.start + 0.05 && snap.phaseAge >= a.start + 0.05) {
          for (let n = 0; n < DISCONNECT_PUFFS; n++) steam.push(disconnect(r, scratch, now - r() * dt, built.tips[i]))
        }
      })
    }

    // exhaust on the launch clock; a jump (first frame, a page opened mid-launch) replays the missing seconds
    const L = launchClock(snap.phase, snap.phaseAge, snap.t)
    if (L !== null) {
      const from = st.lastL === null || L < st.lastL ? Math.max(0, L - EXHAUST_PREWARM) : st.lastL
      if (L > from) {
        for (let l = from; l < L; l += REPLAY_STEP) {
          const step = Math.min(REPLAY_STEP, L - l)
          st.exhaustAcc += exhaustRate(l + step / 2, EXHAUST_PEAK) * step
          while (st.exhaustAcc >= 1) {
            st.exhaustAcc--
            ex.push(exhaust(r, scratch, now - (L - l) + r() * step, thrustAt(l)))
          }
        }
      } else {
        // a frozen clock keeps the present rate going
        st.exhaustAcc += exhaustRate(L, EXHAUST_PEAK) * dt
        while (st.exhaustAcc >= 1) {
          st.exhaustAcc--
          ex.push(exhaust(r, scratch, now - r() * dt, thrustAt(L)))
        }
      }
    }

    buffer.clearUpdateRanges()
    const a = steam.flush(buffer)
    const b = ex.flush(buffer)
    if (a || b) buffer.needsUpdate = true

    // light
    u.uTime.value = now
    const flame = plumeLight.intensity
    u.uFlameCol.value.copy(FLAME_COLOR).multiplyScalar(flame)
    u.uFlameA.value.set(0, rig.altM - 0.5, 0)
    u.uFlameB.value.set(0, Math.max(rig.altM - 34, TRENCH_FLOOR_Y + 1), 0)
    built.floods.forEach((f, i) => u.uFloodCol.value[i].copy(f.col).multiplyScalar(on ? 1 : 0))

    st.started = true
    st.lastTime = now
    st.lastPhase = snap.phase
    st.lastAge = snap.phaseAge
    st.lastL = L
  })

  return <primitive object={built.mesh} />
}
