import '@brand/fonts.css'
import '@brand/tokens.css'
import { brandLogo } from '@brand/tokens'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { bridge } from './scene/bridge'
import { useGame } from './state/store'
import './styles/app.css'

// lets automated browser checks read the game state; stripped from production builds
if (import.meta.env.DEV) Object.assign(window, { __game: useGame, __bridge: bridge })

document.querySelector<HTMLLinkElement>('link[rel=icon]')!.href = brandLogo.favicon

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
