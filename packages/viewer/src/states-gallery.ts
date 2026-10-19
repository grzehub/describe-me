import type { ManifestFrame, ManifestTest } from '@describe-me/core/types'
import { applyDarkVariant } from './apply-dark-variant.js'
import { autoCanvas } from './auto-canvas.js'
import { canvasOf } from './canvas-of.js'
import { contentBox } from './content-box.js'
import { loadSnapshot } from './data.js'
import { el } from './el.js'
import { fontsSettled } from './fonts-settled.js'
import { framePaint } from './frame-paint.js'
import { replaySnapshot } from './replay-snapshot.js'
import { setCanvas } from './set-canvas.js'
import { stageDarkVariant } from './stage-dark-variant.js'
import { stageDarkVariantReady } from './stage-dark-variant-ready.js'
import { select, state } from './state.js'

/*
 * An overview has a gallery per component, so a newer gallery does not make an
 * older one stale. A repaint replaces the whole overview, and a thumb that left
 * the page drops its snapshot.
 */
async function paintThumb(thumb: HTMLElement, frame: ManifestFrame): Promise<void> {
  const [node] = await Promise.all([loadSnapshot(frame.snapshot), stageDarkVariantReady()])
  if (!thumb.isConnected) {
    return
  }

  const iframe = replaySnapshot(thumb, node, frame.label)
  const fonts = fontsSettled(iframe)

  // Styles are in place after a frame. Only then do the boxes have their final
  // size and the page its colors. This runs before that frame paints, so a
  // thumb never shows the wrong scheme, variant or canvas.
  requestAnimationFrame(() => {
    const canvas = canvasOf(autoCanvas(iframe))
    iframe.style.colorScheme = canvas === 'dark' ? 'dark' : 'light'
    if (iframe.contentDocument) {
      applyDarkVariant(iframe.contentDocument, stageDarkVariant(canvas))
    }

    setCanvas(thumb, canvas, framePaint(iframe))
    fitThumb(thumb, iframe)
  })

  // Web fonts arrive later and change the text's size.
  await fonts
  if (thumb.isConnected) {
    fitThumb(thumb, iframe)
  }
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
  const observer = new IntersectionObserver(
    (entries) => {
      if (!gallery.isConnected) {
        observer.disconnect()
        return
      }

      for (const entry of entries) {
        const frame = pending.get(entry.target)
        if (entry.isIntersecting && frame) {
          pending.delete(entry.target)
          observer.unobserve(entry.target)
          void paintThumb(entry.target as HTMLElement, frame)
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
  const gallery = el('div', { class: 'gallery' })
  const pending = new Map<Element, ManifestFrame>()

  for (const test of tests) {
    const lastIndex = Math.max(0, test.frames.length - 1)
    const last = test.frames[lastIndex]
    const thumb = el('div', { class: 'thumb' })
    thumb.dataset.canvas = canvasOf(null)
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
          click: () => {
            // A thumbnail stands for a recorded frame, so it opens that frame, not Live.
            state.live = false
            select(test.id, lastIndex)
          },
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
    if (gallery.isConnected) {
      paintWhenVisible(gallery, pending)
    }
  })

  return gallery
}
