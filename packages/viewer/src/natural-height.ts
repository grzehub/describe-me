import { contentBox } from './content-box.js'

const BOTTOM_MARGIN = 20
const MIN_HEIGHT = 120

/** The height a fresh stage iframe started at. */
const MEASURING_HEIGHT = 180

/**
 * The iframe height that fits what a snapshot actually paints. A snapshot is a
 * whole document, so at its natural size the frame is a tall empty sheet with
 * the component alone in the top corner.
 */
export function naturalHeight(iframe: HTMLIFrameElement): number | null {
  const body = iframe.contentDocument?.body
  const view = iframe.contentWindow
  if (!body || !view) {
    return null
  }

  // Content sized to the viewport measures as tall as the iframe. Measured at
  // the current height, every fit would add the bottom margin again. The slot
  // keeps its size meanwhile, so `.stage` keeps its scroll.
  const previous = iframe.style.height
  iframe.style.height = `${MEASURING_HEIGHT}px`
  const box = contentBox(body, view)
  iframe.style.height = previous

  if (!box) {
    return null
  }

  return Math.max(MIN_HEIGHT, Math.round(box.bottom + BOTTOM_MARGIN))
}
