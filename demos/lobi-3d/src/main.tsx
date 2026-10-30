import '@brand/fonts.css'
import '@brand/tokens.css'
import { brandLogo } from '@brand/tokens'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/app.css'

document.querySelector<HTMLLinkElement>('link[rel=icon]')!.href = brandLogo.favicon

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
