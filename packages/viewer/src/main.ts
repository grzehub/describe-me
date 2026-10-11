/// <reference types="vite/client" />
import { loadManifest } from './data.js'
import { el } from './el.js'
import { renderHeader } from './header.js'
import { onKey } from './keyboard.js'
import { listenToLive } from './listen-to-live.js'
import { loadLivePreview } from './load-live-preview.js'
import { regions } from './regions.js'
import { renderAll } from './render-all.js'
import { renderFrame } from './render-frame.js'
import { setRerender } from './rerender.js'
import { wireSearchField } from './search-field.js'
import { stateHash } from './state-hash.js'
import { readHash, state } from './state.js'
import { syncSelection } from './sync-selection.js'

setRerender((scope) => {
  if (scope === 'frame') {
    renderFrame()
  } else {
    renderAll()
  }
})

/**
 * Back, Forward and an edited link. Chrome fires both events on Back, and
 * `pushState` fires neither, so a link that already matches the view is ignored.
 */
function onLocationChange(): void {
  if (location.hash.slice(1) === stateHash(state)) {
    return
  }

  readHash()
  if (state.manifest) {
    syncSelection()
  }

  renderAll()
}

readHash()
document.addEventListener('keydown', onKey)
window.addEventListener('popstate', onLocationChange)
window.addEventListener('hashchange', onLocationChange)
listenToLive()
wireSearchField(regions().search)

loadManifest().catch((err) => {
  const { header, center } = regions()
  header.replaceChildren(...renderHeader())
  center.replaceChildren(
    el('div', { class: 'empty' }, `no manifest yet — run vitest first (${String(err)})`),
  )
})

/** A failed refresh is not worth breaking the page over; the next one may succeed. */
const refresh = () => loadManifest().catch(() => undefined)

if (import.meta.hot) {
  // Dev: the Vite plugin pushes an event whenever the reporter rewrites the manifest.
  import.meta.hot.on('describe-me:update', () => void refresh())
  // Only `describe-me dev` serves `__live.json`, so the static site never asks for it.
  void loadLivePreview()
} else {
  // Static site: data only changes on redeploy, so a slow poll is plenty.
  setInterval(() => void refresh(), 60_000)
}
