import { LIVE_MESSAGE_SOURCE, type LiveMessage, type LiveReport } from './types.js'
import { viewerOrigin } from './viewer-origin.js'

/**
 * Posts a report to the viewer that frames the live page. It goes only to the
 * origin the page URL names, so another site that frames the page learns
 * nothing.
 */
export function postLiveMessage(report: LiveReport): void {
  if (window.parent === window) {
    return
  }

  const origin = viewerOrigin()

  if (origin === null) {
    return
  }

  const message: LiveMessage = { source: LIVE_MESSAGE_SOURCE, ...report }

  window.parent.postMessage(message, origin)
}
