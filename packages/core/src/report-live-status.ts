import { applyViewerRequest } from './apply-viewer-request.js'
import { liveState } from './live-state.js'
import { observeLiveBackground } from './observe-live-background.js'
import { observeLiveHeight } from './observe-live-height.js'
import { postLiveMessage } from './post-live-message.js'
import type { LiveReport, LiveStatus } from './types.js'

/** Writes the status on the page itself, so the page is never blank and the viewer can fit it. */
function showStatus(status: LiveStatus, detail: string | undefined): void {
  const note = document.createElement('p')

  note.textContent = detail === undefined ? status : `${status}: ${detail}`
  note.style.whiteSpace = 'pre-wrap'
  document.body.append(note)
}

/**
 * Reports how the live page ended up, on `<html data-describe-me-live>` and to
 * the viewer, after applying the viewer's held request and reporting the
 * page's background. The first status of a page is final, so later calls do
 * nothing.
 */
export function reportLiveStatus(status: LiveStatus, detail?: string): void {
  const state = liveState()

  if (state.status !== null) {
    return
  }

  state.status = status
  document.documentElement.dataset.describeMeLive = status
  // The viewer fades the frame in on this status, so the variant and the
  // page's background must be there first.
  applyViewerRequest()
  observeLiveBackground()

  const report: LiveReport =
    detail === undefined ? { type: 'status', status } : { type: 'status', status, detail }

  postLiveMessage(report)

  if (status !== 'mounted') {
    showStatus(status, detail)
  }

  observeLiveHeight()
}
