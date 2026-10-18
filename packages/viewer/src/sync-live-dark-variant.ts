import type { ViewerMessage } from '@describe-me/core/types'
import { VIEWER_MESSAGE_SOURCE } from '@describe-me/core/types'
import { stageDarkVariant } from './stage-dark-variant.js'
import { state } from './state.js'

/**
 * Post the stage's dark variant to the live page of `slot`, which may run on
 * another origin, so the viewer never touches its document. Nothing goes out
 * before the frame's first `load`, while it still holds `about:blank`, and
 * nothing goes out twice in a row. The variant never goes into `src`, because
 * a new `src` reloads the page.
 */
export function syncLiveDarkVariant(slot: HTMLElement): void {
  const target = slot.querySelector('iframe')?.contentWindow
  const base = state.preview.status === 'ready' ? state.preview.base : undefined

  if (!target || base === undefined || slot.dataset.loaded === undefined) {
    return
  }

  const root = stageDarkVariant()
  const key = JSON.stringify(root)

  if (slot.dataset.darkVariant === key) {
    return
  }

  slot.dataset.darkVariant = key

  const message: ViewerMessage = { source: VIEWER_MESSAGE_SOURCE, type: 'dark-variant', root }

  target.postMessage(message, new URL(base).origin)
}
