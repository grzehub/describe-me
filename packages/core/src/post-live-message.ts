import { LIVE_MESSAGE_SOURCE, type LiveMessage, type LiveReport } from './types.js'

/** The viewer's origin from the page URL, when it is exactly the origin of an http(s) URL. */
function viewerOrigin(): string | null {
  const origin = new URLSearchParams(window.location.search).get('origin')

  if (origin === null) {
    return null
  }

  try {
    const url = new URL(origin)
    const web = url.protocol === 'http:' || url.protocol === 'https:'

    return web && url.origin === origin ? origin : null
  } catch {
    return null
  }
}

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
