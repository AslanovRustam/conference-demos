import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { RareKind, RarePlan } from '../../core/types'
import { useGame } from '../../game/store'
import { params } from '../../platform/params'
import { cancelShotRequest, requestShot } from '../camera/shotRequest'
import type { ShotId } from '../camera/shotIds'
import { horizonDip } from '../env/atmosphere'
import { sunElevationAt } from '../env/lightState'
import { setSunElevation } from '../far/Sun'
import { rig } from '../rig'
import { Aurora } from './Aurora'
import { Meteors } from './Meteors'
import { stepRare } from './rareClock'
import { rareShow } from './rareState'
import { Station } from './Station'
import { sunriseElevation } from './sunrise'
import { SunriseGlow } from './SunriseGlow'

// the camera each event asks for: the horizon shot for the sunrise, the chase (looking out level, the limb low in
// the frame) for the rest
const SHOT_FOR: Record<RareKind, ShotId> = { sunrise: 'sunrise', station: 'sideChase', aurora: 'sideChase', meteors: 'sideChase' }

// the round's rare event (core/rare.ts): its clock, the camera it asks for, the sun of a sunrise round, and the
// near-field part (the station). the far-field parts live in <RareSky /> inside the far field
export function RareEvents() {
  const asked = useRef<RarePlan | null>(null)
  useEffect(() => () => setSunElevation(null), [])

  // after the rig (-10), before the lights (-8) read the sun and the camera (-5) takes the request
  useFrame((_, dt) => {
    const snap = useGame.getState().snap
    const live = snap.phase === 'flight' || snap.phase === 'ejected'
    stepRare(rareShow, snap.rare, rig.stageF, live, snap.frozen, dt * rig.slowmo)
    if (rareShow.active && asked.current !== snap.rare && params.shot === null) {
      asked.current = snap.rare
      requestShot(SHOT_FOR[rareShow.kind!], rareShow.dur * (1 - rareShow.p))
    }
    if (!rareShow.active) cancelShotRequest()
    setSunElevation(
      live && snap.rare?.kind === 'sunrise'
        ? sunriseElevation(sunElevationAt(rig.stageF), -horizonDip(rig.altM), rareShow)
        : null,
    )
  }, -9)

  return <Station />
}

// the far-field parts of the rare events
export function RareSky() {
  return (
    <>
      <Aurora />
      <Meteors />
      <SunriseGlow />
    </>
  )
}
