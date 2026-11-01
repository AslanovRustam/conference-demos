import { expect, test } from 'vitest'
import { canFullscreen, toggleFullscreen, type FullscreenDoc } from './fullscreen'

function fakeDoc(enabled = true, refuse = false) {
  const calls: string[] = []
  const doc: FullscreenDoc = {
    fullscreenEnabled: enabled,
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: async (opts) => {
        calls.push(`enter:${opts?.navigationUI}`)
        if (refuse) throw new TypeError('denied')
        doc.fullscreenElement = doc.documentElement as unknown as Element
      },
    },
    exitFullscreen: async () => {
      calls.push('exit')
      doc.fullscreenElement = null
    },
  }
  return { doc, calls }
}

test('full screen is offered only where the page may take it (an iframe without allow="fullscreen" may not)', () => {
  expect(canFullscreen(fakeDoc(true).doc)).toBe(true)
  expect(canFullscreen(fakeDoc(false).doc)).toBe(false)
  expect(canFullscreen(undefined)).toBe(false)
})

test('the toggle enters full screen without browser chrome, then leaves it', async () => {
  const { doc, calls } = fakeDoc()
  await toggleFullscreen(doc)
  expect(doc.fullscreenElement).not.toBeNull()
  await toggleFullscreen(doc)
  expect(doc.fullscreenElement).toBeNull()
  expect(calls).toEqual(['enter:hide', 'exit'])
})

test('a browser refusing full screen is not an error', async () => {
  const { doc } = fakeDoc(true, true)
  await expect(toggleFullscreen(doc)).resolves.toBeUndefined()
  expect(doc.fullscreenElement).toBeNull()
})
