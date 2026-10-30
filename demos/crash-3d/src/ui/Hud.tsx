import { brandLogo } from '@brand/tokens'
import { AltitudeScale } from './AltitudeScale'
import { Balance } from './Balance'
import { Banner } from './Banner'
import { BetControls } from './BetControls'
import { Confetti } from './Confetti'
import { Countdown } from './Countdown'
import { History } from './History'
import './hud.css'
import { MainButton } from './MainButton'
import { Multiplier } from './Multiplier'
import { MuteButton } from './MuteButton'
import { ResultOverlay } from './ResultOverlay'
import { Telemetry } from './Telemetry'
import { WinBurst } from './WinBurst'

// broadcast hud over the scene; layout switches on aspect ratio in hud.css
export function Hud() {
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

      <Confetti />
      <Countdown />
      <WinBurst />
      <ResultOverlay />
      <Banner />

      <BetControls />
      <MainButton />
    </div>
  )
}
