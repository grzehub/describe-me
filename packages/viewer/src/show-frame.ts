import type { Manifest } from '@describe-me/core/types'
import { fetchManifest } from './fetch-manifest.js'
import { fetchSnapshot } from './fetch-snapshot.js'
import type { FontFailures } from './fonts-settled.js'
import { fontsSettled } from './fonts-settled.js'
import type { FrameParams } from './frame-params.js'
import { imagesSettled } from './images-settled.js'
import { naturalHeight } from './natural-height.js'
import { previewHeadHtml } from './preview-head.js'
import { replaySnapshot } from './replay-snapshot.js'
import { restoreStyles } from './restore-styles.js'
import type { SerializedNode } from './serialized-node.js'

/** The height a frame is measured at, so content that follows the viewport gets it. */
const VIEWPORT_HEIGHT = 720

const MAX_HEIGHT = 1600
const FONTS_TIMEOUT_MS = 10_000

/**
 * Ahead of the preview head and the hover and focus classes, so no transition
 * ever starts and no caret blinks into a screenshot.
 */
const STILL_STYLE =
  '<style>*, ::before, ::after { transition: none !important; caret-color: transparent !important }</style>'

/** A frame on the page, ready for a screenshot. */
export interface ShownFrame {
  /** The frame's height in CSS pixels. */
  height: number
  /** Fonts and linked stylesheets that did not load, such as `font Inter`. */
  missing: string[]
}

function animationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number): void => {
      if (left === 0) {
        resolve()
      } else {
        requestAnimationFrame(() => step(left - 1))
      }
    }

    step(count)
  })
}

/**
 * Finished, an animation shows its end state, as the stage shows it once it
 * ran. `animation: none` could leave a fade-in at its start. An infinite one
 * cannot finish, so it is cancelled.
 */
function finishAnimations(doc: Document): void {
  for (const animation of doc.getAnimations()) {
    try {
      animation.finish()
    } catch {
      animation.cancel()
    }
  }
}

function missingOf(failures: FontFailures): string[] {
  return [
    ...failures.families.map((family) => `font ${family}`),
    ...failures.stylesheets.map((name) => `stylesheet ${name}`),
  ]
}

async function loadFrame(
  params: FrameParams,
): Promise<{ manifest: Manifest; node: SerializedNode }> {
  const [manifest, node] = await Promise.all([
    fetchManifest(params.data),
    fetchSnapshot(params.snapshot, params.data),
  ])

  if (typeof node !== 'object' || node === null) {
    throw new Error(`snapshot ${params.snapshot} holds no document`)
  }

  // A frame without some of its CSS would compare wrongly.
  if (!(await restoreStyles(node, params.data))) {
    throw new Error(`a style chunk of ${params.snapshot} did not load`)
  }

  return { manifest, node }
}

/**
 * Replay one snapshot of a data directory into `root` for a screenshot: in
 * the light scheme at `params.width`, with its preview head, once its fonts
 * and images loaded, without transitions, its CSS animations finished and the
 * caret hidden. The frame gets its natural height up to 1600 CSS pixels.
 * Throws when the snapshot or one of its style chunks does not load.
 */
export async function showFrame(root: HTMLElement, params: FrameParams): Promise<ShownFrame> {
  const { manifest, node } = await loadFrame(params)
  const head = `${STILL_STYLE}${previewHeadHtml(manifest, params.data)}`
  const iframe = replaySnapshot(root, node, 'snapshot', head)
  const fonts = fontsSettled(iframe, FONTS_TIMEOUT_MS)

  iframe.style.display = 'block'
  iframe.style.border = '0'
  iframe.style.width = `${params.width}px`
  iframe.style.height = `${VIEWPORT_HEIGHT}px`

  const failures = await fonts
  await imagesSettled(iframe)

  if (iframe.contentDocument) {
    finishAnimations(iframe.contentDocument)
  }

  await animationFrames(2)

  const height = Math.min(naturalHeight(iframe, VIEWPORT_HEIGHT) ?? VIEWPORT_HEIGHT, MAX_HEIGHT)
  iframe.style.height = `${height}px`
  await animationFrames(2)

  return { height, missing: missingOf(failures) }
}
