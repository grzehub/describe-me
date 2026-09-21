import { createCache, createMirror, rebuildIntoSandboxedIframe } from 'rrweb-snapshot'
import type { ManifestFrame, ManifestTest } from '@describe-me/core/types'
import { loadSnapshot } from './data.js'
import { el } from './el.js'
import { select } from './state.js'

/** Bumped on every gallery render, so snapshots that arrive late are dropped. */
let galleryToken = 0

async function paintThumb(thumb: HTMLElement, frame: ManifestFrame, token: number): Promise<void> {
  const node = await loadSnapshot(frame.snapshot)
  if (token !== galleryToken || !thumb.isConnected) {
    return
  }

  const { iframe } = rebuildIntoSandboxedIframe(node, {
    root: thumb,
    iframeAttributes: { title: frame.label },
    cache: createCache(),
    mirror: createMirror(),
    hackCss: true,
  })

  // Styles are in place after a frame; only then do the boxes have their final size.
  requestAnimationFrame(() => fitThumb(thumb, iframe))
}

const SKIPPED_TAGS = new Set(['SCRIPT', 'NOSCRIPT', 'STYLE', 'LINK', 'META', 'TITLE'])

/**
 * Whether an element draws something itself. Layout wrappers (the test
 * container, a full-width flex row) stretch across the page and would make
 * every thumbnail zoom out to the whole viewport.
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

/** The box around everything that actually paints in the snapshot, in the iframe's own pixels. */
function contentBox(body: HTMLElement, view: Window): DOMRect | null {
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

const THUMB_PADDING = 16

/**
 * Zoom the snapshot so the component fills the tile instead of sitting in the
 * corner of a full-size page. Never enlarges beyond natural size.
 */
function fitThumb(thumb: HTMLElement, iframe: HTMLIFrameElement): void {
  const body = iframe.contentDocument?.body
  const view = iframe.contentWindow
  const box = body && view ? contentBox(body, view) : null
  if (!box) {
    return
  }

  const width = thumb.clientWidth - THUMB_PADDING * 2
  const height = thumb.clientHeight - THUMB_PADDING * 2
  const scale = Math.min(width / box.width, height / box.height, 1)
  const offsetX = THUMB_PADDING + (width - box.width * scale) / 2 - box.x * scale
  const offsetY = THUMB_PADDING + (height - box.height * scale) / 2 - box.y * scale

  iframe.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
}

/**
 * The overview column scrolls, not the page, and an observer rooted at the
 * viewport would never see the tiles below its fold.
 */
function scrollRoot(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement
  while (parent) {
    const overflow = getComputedStyle(parent).overflowY
    if (overflow === 'auto' || overflow === 'scroll') {
      return parent
    }

    parent = parent.parentElement
  }

  return null
}

/** Build each thumbnail once its tile comes near the visible part of the column. */
function paintWhenVisible(gallery: HTMLElement, pending: Map<Element, ManifestFrame>): void {
  const token = galleryToken
  const observer = new IntersectionObserver(
    (entries) => {
      if (token !== galleryToken) {
        observer.disconnect()
        return
      }

      for (const entry of entries) {
        const frame = pending.get(entry.target)
        if (entry.isIntersecting && frame) {
          pending.delete(entry.target)
          observer.unobserve(entry.target)
          void paintThumb(entry.target as HTMLElement, frame, token)
        }
      }
    },
    { root: scrollRoot(gallery), rootMargin: '400px' },
  )

  for (const thumb of pending.keys()) {
    observer.observe(thumb)
  }
}

/** One scaled-down tile per test, showing its last frame and leading to it. */
export function renderStatesGallery(tests: ManifestTest[]): HTMLElement {
  const token = ++galleryToken
  const gallery = el('div', { class: 'gallery' })
  const pending = new Map<Element, ManifestFrame>()

  for (const test of tests) {
    const lastIndex = Math.max(0, test.frames.length - 1)
    const last = test.frames[lastIndex]
    const thumb = el('div', { class: 'thumb' })
    if (last) {
      pending.set(thumb, last)
    } else {
      thumb.append(el('div', { class: 'hint' }, 'no frames'))
    }

    gallery.append(
      el(
        'button',
        {
          class: 'tile',
          title: test.fullName,
          click: () => select(test.id, lastIndex),
        },
        thumb,
        el(
          'span',
          { class: 'cap' },
          el('span', { class: `dot ${test.state}` }),
          el('span', { class: 'cap-name' }, test.name),
        ),
      ),
    )
  }

  // The scroll container only exists once the caller has put the gallery on screen.
  requestAnimationFrame(() => {
    if (token === galleryToken && gallery.isConnected) {
      paintWhenVisible(gallery, pending)
    }
  })

  return gallery
}
