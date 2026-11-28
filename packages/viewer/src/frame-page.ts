import { frameParams } from './frame-params.js'
import type { ShownFrame } from './show-frame.js'
import { showFrame } from './show-frame.js'

// The entry of frame.html, the page that `describe-me diff --shots` takes its
// screenshots of. It reports on <html>, with `data-status` set last, so whoever
// waits for the status reads the other attributes complete.
const html = document.documentElement

function ready(shown: ShownFrame): void {
  if (shown.missing.length > 0) {
    html.dataset.missing = shown.missing.join(', ')
  }

  html.dataset.height = String(shown.height)
  html.dataset.status = 'ready'
}

function failed(error: unknown): void {
  html.dataset.error = error instanceof Error ? error.message : String(error)
  html.dataset.status = 'error'
}

async function show(): Promise<ShownFrame> {
  return showFrame(document.body, frameParams(location.search))
}

show().then(ready).catch(failed)
