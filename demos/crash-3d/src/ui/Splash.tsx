import { brandLogo } from '@brand/tokens'
import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { params } from '../platform/params'
import { loadCloudNoise } from '../scene/clouds/noise'
import { S } from '../strings'

const FADE_MS = 900
const COMPILE_S = 12 // the shader compile has no progress of its own: the bar creeps towards the end over about this

// the load screen over the stage: the red logo and a thin red progress line on black, it dissolves once the scene
// is on screen. textures, the cloud noise and the fonts fill most of the line, the shader compile the rest.
// embedded, the lobby shows its own branding: the line alone (the lobby may reveal the game before it is ready)
export function Splash() {
  const ready = useGame((s) => s.ready)
  const textures = useProgress((s) => s.progress) / 100
  const [noise, setNoise] = useState(false)
  const [fonts, setFonts] = useState(false)
  const [gone, setGone] = useState(false)
  const [, tick] = useState(0)
  const assetsAt = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    void loadCloudNoise().then(() => live && setNoise(true))
    void document.fonts.ready.then(() => live && setFonts(true))
    return () => {
      live = false
    }
  }, [])
  // redraw the creeping bar while the shaders compile
  useEffect(() => {
    if (ready) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [ready])
  useEffect(() => {
    if (!ready) return
    const id = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(id)
  }, [ready])

  if (gone) return null
  const assets = textures * 0.55 + (noise ? 0.15 : 0) + (fonts ? 0.05 : 0)
  if (assets >= 0.75 && assetsAt.current === null) assetsAt.current = performance.now()
  const compile = assetsAt.current === null ? 0 : 0.23 * (1 - Math.exp(-(performance.now() - assetsAt.current) / 1000 / (COMPILE_S / 3)))
  const value = ready ? 1 : Math.min(0.98, assets + compile)

  return (
    <div className={`splash${ready ? ' splash--out' : ''}`} role="progressbar" aria-label={S.loading} aria-valuenow={Math.round(value * 100)}>
      {!params.embed && <img className="splash-logo" src={brandLogo.red} alt="Clickable" draggable={false} />}
      <div className="splash-track">
        <div className="splash-bar" style={{ transform: `scaleX(${value.toFixed(4)})` }} />
      </div>
    </div>
  )
}
