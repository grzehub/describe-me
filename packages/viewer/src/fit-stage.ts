import { contentBox } from './content-box.js'

const BOTTOM_MARGIN = 20
const MIN_HEIGHT = 120

/**
 * Shrink the replay frame to what the snapshot actually paints. A snapshot is
 * a whole document, so at its natural size the frame is a tall empty sheet
 * with the component alone in the top corner.
 */
export function fitStage(iframe: HTMLIFrameElement): void {
  const body = iframe.contentDocument?.body
  const view = iframe.contentWindow
  const box = body && view ? contentBox(body, view) : null
  if (!box) {
    return
  }

  iframe.style.height = `${Math.max(MIN_HEIGHT, Math.round(box.bottom + BOTTOM_MARGIN))}px`
}
