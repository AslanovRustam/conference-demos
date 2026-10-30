import { useEffect } from 'react'
import rawConfig from '../games.config.json'
import { buildSlots, loadManifest, validateConfig } from './config/games'
import Carousel from './scene/Carousel'
import LobbyCanvas from './scene/LobbyCanvas'
import { lobbyStore } from './state/store'

const config = validateConfig(rawConfig)

function selectCabinet(index: number) {
  const s = lobbyStore.getState()
  if (index === s.activeIndex) s.enter()
  else s.focus(index)
}

export default function App() {
  useEffect(() => {
    loadManifest().then((manifest) => lobbyStore.getState().init(buildSlots(config, manifest)))
  }, [])

  return (
    <div className="app">
      <LobbyCanvas>
        <Carousel onSelect={selectCabinet} />
      </LobbyCanvas>
    </div>
  )
}
