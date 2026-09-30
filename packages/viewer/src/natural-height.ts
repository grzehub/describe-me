import { contentBox } from './content-box.js'
import { MIN_FRAME_HEIGHT } from './min-frame-height.js'

const BOTTOM_MARGIN = 20

/** The smallest height to measure at, the height a fresh stage iframe starts at. */
const MIN_MEASURING_HEIGHT = 180

/** How much taller the second measurement is, to tell content that follows the viewport. */
const PROBE_STEP = 100

/** Room above and below a dialog taller than the stage. */
const DIALOG_MARGIN = 40

function measureAt(
  iframe: HTMLIFrameElement,
  body: HTMLElement,
  view: Window,
  height: number,
): DOMRect | null {
  iframe.style.height = `${height}px`

  return contentBox(body, view)
}

function moved(first: DOMRect, second: DOMRect): boolean {
  return Math.abs(first.top - second.top) >= 1 || Math.abs(first.bottom - second.bottom) >= 1
}

function fitContent(box: DOMRect): number {
  return Math.max(MIN_FRAME_HEIGHT, Math.round(box.bottom + BOTTOM_MARGIN))
}

/**
 * The iframe height that fits what a snapshot actually paints. A snapshot is a
 * whole document, so at its natural size the frame is a tall empty sheet with
 * the component alone in the top corner. Content sized to the viewport gets
 * the stage's visible height, in the iframe's pixels, or room for all of it.
 */
export function naturalHeight(iframe: HTMLIFrameElement, visibleHeight: number): number | null {
  const body = iframe.contentDocument?.body
  const view = iframe.contentWindow
  if (!body || !view) {
    return null
  }

  // Measured at the current height, content sized to the viewport would grow
  // by the bottom margin on every fit. The measuring height comes from the
  // stage, whose size comes from the grid, so fitting never feeds back. The
  // slot keeps its size meanwhile, so `.stage` keeps its scroll.
  const viewport = Math.max(MIN_MEASURING_HEIGHT, Math.round(visibleHeight))
  const previous = iframe.style.height
  const box = measureAt(iframe, body, view, viewport)
  if (!box || (box.top >= 0 && box.bottom < viewport - 1)) {
    iframe.style.height = previous

    return box ? fitContent(box) : null
  }

  const taller = measureAt(iframe, body, view, viewport + PROBE_STEP)
  iframe.style.height = previous

  if (!taller || !moved(box, taller)) {
    return fitContent(box)
  }

  // A centred or bottom-anchored box taller than the stage starts above the top.
  if (box.top < 0) {
    return Math.max(viewport, Math.round(box.height) + DIALOG_MARGIN)
  }

  // A full-height layout or a backdrop fills the stage, like a screen would.
  return viewport
}
