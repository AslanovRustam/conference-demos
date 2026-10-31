import { brandLogo } from '@brand/tokens'
import { useGame } from '../game/store'
import { params } from '../platform/params'
import { AltitudeScale } from './AltitudeScale'
import { AttractOverlay } from './AttractOverlay'
import { Balance } from './Balance'
import { Banner } from './Banner'
import { BetControls } from './BetControls'
import { Chart } from './Chart'
import { Confetti } from './Confetti'
import { Countdown } from './Countdown'
import { History } from './History'
import './hud.css'
import { MainButton } from './MainButton'
import { Multiplier } from './Multiplier'
import { MuteButton } from './MuteButton'
import { PresenterDot } from './PresenterDot'
import { PresenterPanel } from './PresenterPanel'
import { ResultOverlay } from './ResultOverlay'
import { Telemetry } from './Telemetry'
import { useLongPress } from './useLongPress'
import { WinBurst } from './WinBurst'

const PRESENTER_HOLD_MS = 2000

// broadcast hud over the scene; layout switches on aspect ratio in hud.css
export function Hud() {
  const attract = useGame((s) => s.snap.attract)
  const setPresenterOpen = useGame((s) => s.setPresenterOpen)
  const hold = useLongPress(PRESENTER_HOLD_MS, () => setPresenterOpen(true))
  return (
    <div className="hud" data-attract={attract || undefined} data-embed={params.embed || undefined}>
      <div className="hud-shade" aria-hidden />
      <div className="hud-bar hud-bar--top" aria-hidden />
      <div className="hud-bar hud-bar--bottom" aria-hidden />
      <Chart />

      <div className="hud-brand">
        <span className="hud-logo-hold" {...hold}>
          <img className="hud-logo" src={brandLogo.red} alt="Clickable" draggable={false} />
          <PresenterDot />
        </span>
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

      <AttractOverlay />
      <PresenterPanel />
    </div>
  )
}
