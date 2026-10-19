import { liveState } from './live-state.js'
import { postLiveMessage } from './post-live-message.js'

function postBackground(): void {
  const background = liveState().background
  const html = getComputedStyle(document.documentElement).backgroundColor
  const body = getComputedStyle(document.body).backgroundColor
  const reported = background.reported

  if (reported?.html === html && reported.body === body) {
    return
  }

  background.reported = { html, body }
  postLiveMessage({ type: 'background', html, body })
}

function schedule(): void {
  const background = liveState().background

  if (background.queued) {
    return
  }

  background.queued = true

  requestAnimationFrame(() => {
    background.queued = false
    postBackground()
  })
}

/**
 * Reports the computed `background-color` of `<html>` and `<body>` now and
 * whenever either changes, so the viewer can paint its canvas to match. The
 * whole document is watched, because a `<style>` in `<head>`, the root's class
 * and the viewer's scheme can all change it. Runs once per page.
 */
export function observeLiveBackground(): void {
  const background = liveState().background

  if (background.observing) {
    return
  }

  background.observing = true

  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule)
  // A page that transitions its background reports the color it ends on.
  document.addEventListener('transitionend', schedule, true)
  postBackground()
}
