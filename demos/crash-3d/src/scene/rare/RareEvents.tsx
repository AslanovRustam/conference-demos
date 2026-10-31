import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { useGame } from '../../game/store'
import { horizonDip } from '../env/atmosphere'
import { overrideSunAzimuth, sunElevationAt } from '../env/lightState'
import { setSunElevation } from '../far/Sun'
import { rig } from '../rig'
import { Aurora } from './Aurora'
import { Meteors } from './Meteors'
import { stepRare } from './rareClock'
import { rareShow } from './rareState'
import { Station } from './Station'
import { sunriseElevation } from './sunrise'
import { SunriseGlow } from './SunriseGlow'


// a sunrise round turns the sun into the crash view (it looks along -z, azimuth π; +x, screen right, is π/2):
// right of centre, by the rocket
const SUNRISE_AZIMUTH = Math.PI - 0.4

// the round's rare event (core/rare.ts): its clock, the sun of a sunrise round, and the near-field part (the
// station); all of it plays inside the one crash view. the far-field parts live in <RareSky /> inside the far field
export function RareEvents() {
  useEffect(
    () => () => {
      setSunElevation(null)
      overrideSunAzimuth(null)
    },
    [],
  )

  // after the rig (-10), before the lights (-8) read the sun
  useFrame((_, dt) => {
    const snap = useGame.getState().snap
    const live = snap.phase === 'flight' || snap.phase === 'ejected'
    stepRare(rareShow, snap.rare, rig.stageF, live, snap.frozen, dt * rig.slowmo)
    const sunrise = live && snap.rare?.kind === 'sunrise'
    setSunElevation(sunrise ? sunriseElevation(sunElevationAt(rig.stageF), -horizonDip(rig.altM), rareShow) : null)
    overrideSunAzimuth(sunrise ? SUNRISE_AZIMUTH : null)
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
