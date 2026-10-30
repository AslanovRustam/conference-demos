import rawConfig from '../games.config.json'
import { buildSlots, loadManifest, validateConfig, type GameEntry } from './config/games'
import { useAttract, useControls, wasJustDragged } from './input/useControls'
import ExitButton from './game/ExitButton'
import GameFrame from './game/GameFrame'
import CameraRig from './scene/CameraRig'
import Carousel from './scene/Carousel'
import LobbyCanvas from './scene/LobbyCanvas'
import { params } from './state/params'
import { lobbyStore } from './state/store'
import FpsMeter from './ui/FpsMeter'
import Hud from './ui/Hud'
import LoadingScreen from './ui/LoadingScreen'

const config = validateConfig(rawConfig)

// dev only: a stub game with the full lobby contract, to work on transitions without real games
const devExtras: GameEntry[] = import.meta.env.DEV
  ? [{ id: 'test-game', title: 'TEST GAME', subtitle: 'Dev stub', url: `test-game/?${params.testGameQuery}` }]
  : []

// once per page: StrictMode runs the loading effect twice in dev
let preparing: Promise<void> | null = null
function prepare() {
  preparing ??= loadManifest().then((manifest) => lobbyStore.getState().init(buildSlots(config, manifest, devExtras)))
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
  return (
    <div className="app">
      <LobbyCanvas>
        <Carousel onSelect={selectCabinet} />
        <CameraRig />
      </LobbyCanvas>
      <Hud />
      <GameFrame />
      <ExitButton />
      <FpsMeter />
      <LoadingScreen prepare={prepare} />
    </div>
  )
}
