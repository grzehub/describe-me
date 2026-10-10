import { liveState } from './live-state.js'
import { postLiveMessage } from './post-live-message.js'

/** Room under the lowest box, as the viewer leaves under a recorded frame. */
const BOTTOM_MARGIN = 20
const SKIPPED_TAGS = new Set(['SCRIPT', 'NOSCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'TEMPLATE'])

function hasOwnText(element: Element): boolean {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
  )
}

/**
 * Whether an element draws something itself. Layout wrappers can stretch to
 * the height of the frame, and would keep the height from ever shrinking.
 */
function paints(element: Element): boolean {
  if (element.children.length === 0 || hasOwnText(element)) {
    return true
  }

  const style = getComputedStyle(element)
  const hasBackground =
    style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent'

  const hasBorder = parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderBottomWidth) > 0

  return hasBackground || hasBorder || style.boxShadow !== 'none'
}

function* elementsIn(root: Element): Generator<Element> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    yield node as Element
  }
}

/** The bottom of the lowest painted element in page pixels, plus the margin, or 0 for none. */
function contentHeight(): number {
  let bottom = 0

  for (const element of elementsIn(document.body)) {
    if (SKIPPED_TAGS.has(element.tagName) || !paints(element)) {
      continue
    }

    const rect = element.getBoundingClientRect()

    if (rect.width > 0 && rect.height > 0) {
      bottom = Math.max(bottom, rect.bottom + window.scrollY)
    }
  }

  return bottom > 0 ? Math.ceil(bottom + BOTTOM_MARGIN) : 0
}

function postHeight(): void {
  const height = liveState().height
  const measured = contentHeight()

  if (measured === height.reported) {
    return
  }

  height.reported = measured
  postLiveMessage({ type: 'size', height: measured })
}

function schedule(): void {
  const height = liveState().height

  if (height.queued) {
    return
  }

  height.queued = true

  requestAnimationFrame(() => {
    height.queued = false
    postHeight()
  })
}

/**
 * Reports the height of the page's content now and whenever it changes, so
 * the viewer can fit its frame. `scrollHeight` would never drop below the
 * height of the frame itself. Runs once per page.
 */
export function observeLiveHeight(): void {
  const height = liveState().height

  if (height.observing) {
    return
  }

  height.observing = true
  new ResizeObserver(schedule).observe(document.body)

  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })

  window.addEventListener('resize', schedule)
  void document.fonts.ready.then(schedule)
  postHeight()
}
