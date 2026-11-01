import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Group, PointLight } from 'three'
import { brandColors } from '@brand/tokens'
import { runtime } from '../../game/runtime'
import { vibrate } from '../../platform/haptics'
import { fx } from '../fx'
import { registerPrewarm } from '../prewarm'
import { telemetry } from '../../core/telemetry'
import { rig } from '../rig'
import { createBlast } from './blast'
import { Debris } from './Debris'
import { Fireball } from './Fireball'
import { Shockwave } from './Shockwave'
import { crashTimeline } from './timeline'

const MID = 24 // the blast goes off around the rocket's middle
const LIGHT_CD = 60000
const SHAKE = 2.5 // camera shake at the peak (CameraRig scales it to radians)
const WHITE = new Color(1, 1, 1)
const RED = new Color(brandColors.red)

// the crash: fireball, shockwave, debris and the screen hit (flash white → brand red, chroma, shake, zoom blur).
// everything runs on rig.vtime, so the slow motion after the crash stretches it; after a cash out it is shorter
export function Explosion() {
  const blast = useRef(createBlast())
  const group = useRef<Group>(null)
  const light = useMemo(() => new PointLight(0xff9a50, 0, 0, 2), [])

  useEffect(() => (group.current ? registerPrewarm(group.current) : undefined), [])

  useEffect(
    () =>
      runtime.emitter.on((e) => {
        if (e.type === 'betting') {
          blast.current.active = false
          return
        }
        if (e.type !== 'crash') return
        // after a cash out the camera stays on the capsule: the rocket goes off far above, out of the picture
        if (e.cashedOut) return
        const b = blast.current
        b.active = true
        b.x = 0
        // the altitude the rig settles on after the crash (the crash point exactly), not last frame's: high up a
        // hundredth of a multiplier is a kilometre
        b.alt = telemetry(e.multiplier).altKm * 1000 + MID
        b.z = 0
        b.vtime0 = rig.vtime
        b.short = e.cashedOut
        b.inAir = e.stage <= 1
        vibrate([60, 40, 120])
      }),
    [],
  )

  // before the camera (-5) like the free capsule: high up the near field moves fast
  useFrame(() => {
    const b = blast.current
    const g = group.current
    if (g) {
      g.visible = b.active
      g.position.set(b.x, b.alt - rig.nearOffset, b.z)
    }
    if (!b.active) {
      fx.flash = 0
      fx.chromaPulse = 0
      fx.shake = 0
      fx.zoomPulse = 0
      light.intensity = 0
      return
    }
    const beat = crashTimeline(rig.vtime - b.vtime0, b.short)
    fx.flash = beat.flash
    fx.flashColor.copy(WHITE).lerp(RED, beat.flashRed)
    fx.chromaPulse = beat.chroma
    fx.shake = beat.shake * SHAKE
    fx.zoomPulse = beat.zoom
    // the light stays in the scene at intensity 0 between blasts: hiding a light recompiles every lit material
    light.intensity = LIGHT_CD * beat.fireHeat * beat.fireHeat
    light.position.set(b.x, b.alt - rig.nearOffset, b.z)
  }, -6)

  return (
    <>
      <group ref={group} name="explosion" visible={false}>
        <Fireball blast={blast} />
        <Shockwave blast={blast} />
      </group>
      {/* the pieces live in absolute altitude themselves */}
      <Debris blast={blast} />
      <primitive object={light} />
    </>
  )
}
