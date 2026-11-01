import '@brand/fonts.css'
import '@brand/tokens.css'
import { brandLogo } from '@brand/tokens'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { params } from './platform/params'
import './styles/global.css'

document.querySelector<HTMLLinkElement>('link[rel=icon]')!.href = brandLogo.favicon

// offline after the first visit (production only; inside the lobby the lobby's own worker serves)
if (import.meta.env.PROD && !params.embed) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
