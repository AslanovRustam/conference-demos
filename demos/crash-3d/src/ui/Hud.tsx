import { brandLogo } from '@brand/tokens'
import { useEffect } from 'react'
import { markReady } from '../game/debug'
import { AltitudeScale } from './AltitudeScale'
import { Balance } from './Balance'
import { Banner } from './Banner'
import { BetControls } from './BetControls'
import { Countdown } from './Countdown'
import { History } from './History'
import './hud.css'
import { MainButton } from './MainButton'
import { Multiplier } from './Multiplier'
import { MuteButton } from './MuteButton'
import { ResultOverlay } from './ResultOverlay'
import { Telemetry } from './Telemetry'

// broadcast hud over the scene; layout switches on aspect ratio in hud.css
export function Hud() {
  useEffect(() => markReady(), [])

  return (
    <div className="hud">
      <div className="hud-shade" aria-hidden />
      <div className="hud-bar hud-bar--top" aria-hidden />
      <div className="hud-bar hud-bar--bottom" aria-hidden />

      <div className="hud-brand">
        <img className="hud-logo" src={brandLogo.red} alt="Clickable" draggable={false} />
        <MuteButton />
      </div>
      <Telemetry />
      <Balance />
      <History />
      <Multiplier />
      <AltitudeScale />

      <Countdown />
      <ResultOverlay />
      <Banner />

      <BetControls />
      <MainButton />
    </div>
  )
}
