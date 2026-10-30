// Dev-only stand-in for a real game, implementing the whole lobby contract (spec §13).
// Query: noready=1 (never send clickable:ready), slow=<ms> (loading time before the canvas
// and the ready message appear, default 800), noexit=1 (no own exit button).
import type { LobbyMessage } from '../src/bridge/protocol'

const q = new URLSearchParams(location.search)
const noready = q.get('noready') === '1'
const slow = Number(q.get('slow') ?? 800)
const noexit = q.get('noexit') === '1'

const received: LobbyMessage[] = []
Object.assign(window, { __received: received })

const status = document.getElementById('status')!
const log = (line: string) => {
  status.textContent = `${status.textContent}${line}\n`
}
log(`embed=${q.get('embed')} noready=${noready} slow=${slow} noexit=${noexit}`)

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return
  received.push(e.data as LobbyMessage)
  log(`← ${JSON.stringify(e.data)}`)
})

const exit = document.getElementById('exit') as HTMLButtonElement
exit.hidden = noexit
exit.addEventListener('click', () => parent.postMessage({ type: 'clickable:exit' }, '*'))

function startCanvas() {
  const canvas = document.createElement('canvas')
  document.body.prepend(canvas)
  const ctx = canvas.getContext('2d')!
  let frame = 0
  const draw = () => {
    const w = (canvas.width = innerWidth)
    const h = (canvas.height = innerHeight)
    frame++
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#14060a' : '#2a0810'
      const x = ((i * w) / 6 + frame * 4) % (w * 2) - w / 2
      ctx.fillRect(x, 0, w / 12, h)
    }
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = `900 ${Math.round(h / 7)}px system-ui`
    ctx.fillText('TEST GAME', w / 2, h / 2)
    ctx.font = `600 ${Math.round(h / 30)}px system-ui`
    ctx.fillText(`frame ${frame}`, w / 2, h / 2 + h / 12)
    requestAnimationFrame(draw)
  }
  draw()
}

setTimeout(() => {
  startCanvas()
  if (!noready) {
    parent.postMessage({ type: 'clickable:ready' }, '*')
    log('→ clickable:ready')
  }
}, slow)
