const SKIPPED_TAGS = new Set(['SCRIPT', 'NOSCRIPT', 'STYLE', 'LINK', 'META', 'TITLE'])

/**
 * Whether an element draws something itself. Layout wrappers (the test
 * container, a full-width flex row) stretch across the page and would make
 * every measurement fall back to the whole viewport.
 */
function isVisual(element: Element, view: Window): boolean {
  if (element.children.length === 0) {
    return true
  }

  const style = view.getComputedStyle(element)
  const hasBackground =
    style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent'

  const hasBorder = parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderLeftWidth) > 0
  const hasShadow = style.boxShadow !== 'none'

  return hasBackground || hasBorder || hasShadow
}

/** The box around everything that actually paints in a snapshot, in the iframe's own pixels. */
export function contentBox(body: HTMLElement, view: Window): DOMRect | null {
  let box: DOMRect | null = null

  for (const element of Array.from(body.querySelectorAll('*'))) {
    if (SKIPPED_TAGS.has(element.tagName) || !isVisual(element, view)) {
      continue
    }

    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      continue
    }

    if (!box) {
      box = DOMRect.fromRect(rect)
      continue
    }

    const right = Math.max(box.right, rect.right)
    const bottom = Math.max(box.bottom, rect.bottom)
    box.x = Math.min(box.x, rect.x)
    box.y = Math.min(box.y, rect.y)
    box.width = right - box.x
    box.height = bottom - box.y
  }

  return box
}
