import gsap from 'gsap'

/** full-screen colour flash over the canvas; used to hide the world switch */
export function flashScreen(color: string, fadeIn: number, hold: number, fadeOut: number) {
  const el = document.getElementById('flash')
  if (!el) return Promise.resolve()
  el.style.background = color
  return new Promise<void>((resolve) => {
    gsap
      .timeline()
      .to(el, { opacity: 1, duration: fadeIn, ease: 'power2.in' })
      .call(resolve)
      .to(el, { opacity: 0, duration: fadeOut, delay: hold, ease: 'power2.out' })
  })
}
