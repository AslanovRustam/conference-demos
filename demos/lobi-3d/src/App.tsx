import { useLobbySound } from './audio/useLobbySound'
import { applyPreviews, buildSlots, loadManifest, loadPreviews, type GameEntry } from './config/games'
import { config } from './config/lobbyConfig'
import { useAttract, useControls, wasJustDragged } from './input/useControls'
import GameFrame from './game/GameFrame'
import CameraRig from './scene/CameraRig'
import Carousel from './scene/Carousel'
import LobbyCanvas from './scene/LobbyCanvas'
import { params } from './state/params'
import { lobbyStore } from './state/store'
import FpsMeter from './ui/FpsMeter'
import Hud from './ui/Hud'
import LoadingScreen from './ui/LoadingScreen'

// dev only: a stub game with the full lobby contract, to work on transitions without real games
const devExtras: GameEntry[] = import.meta.env.DEV
  ? [{ id: 'test-game', title: 'TEST GAME', subtitle: 'Dev stub', url: `test-game/?${params.testGameQuery}` }]
  : []

// the dev stub takes a cabinet of its own, so dev keeps the same number of COMING SOON places
const devConfig = { ...config, minSlots: config.minSlots + devExtras.length }

// once per page: StrictMode runs the loading effect twice in dev
let preparing: Promise<void> | null = null
function prepare() {
  preparing ??= Promise.all([loadManifest(), loadPreviews()]).then(([manifest, previews]) =>
    lobbyStore.getState().init(applyPreviews(buildSlots(devConfig, manifest, devExtras), previews)),
  )
  return preparing
}

function selectCabinet(index: number) {
  if (wasJustDragged()) return
  const s = lobbyStore.getState()
  if (index === s.activeIndex) s.enter()
  else s.focus(index)
}

export default function App() {
  useControls()
  useAttract()
  useLobbySound()
  return (
    <div className="app">
      <LobbyCanvas>
        <Carousel onSelect={selectCabinet} />
        <CameraRig />
      </LobbyCanvas>
      <Hud />
      <GameFrame />
      <FpsMeter />
      <LoadingScreen prepare={prepare} />
    </div>
  )
}
