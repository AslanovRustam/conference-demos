// the page's own full screen (the lobby's iframe allows it); the stand's kiosk Chrome is full screen already

export interface FullscreenDoc {
  fullscreenEnabled: boolean
  fullscreenElement: Element | null
  documentElement: { requestFullscreen?: (opts?: FullscreenOptions) => Promise<void> }
  exitFullscreen: () => Promise<void>
}

const page = (): FullscreenDoc | undefined => (typeof document === 'undefined' ? undefined : document)

export function canFullscreen(doc = page()): boolean {
  return !!doc?.documentElement.requestFullscreen && doc.fullscreenEnabled
}

export async function toggleFullscreen(doc = page()): Promise<void> {
  if (!doc) return
  try {
    if (doc.fullscreenElement) await doc.exitFullscreen()
    else await doc.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
  } catch {
    // the browser said no (no user gesture, a policy): the button just does nothing
  }
}
