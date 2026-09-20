/// <reference types="vite/client" />
import { loadManifest } from './data.js'
import { el } from './el.js'
import { renderHeader } from './header.js'
import { onKey } from './keyboard.js'
import { renderAll } from './render-all.js'
import { setRerender } from './rerender.js'
import { readHash } from './state.js'

setRerender(renderAll)

readHash()
document.addEventListener('keydown', onKey)
window.addEventListener('hashchange', () => {
  readHash()
  renderAll()
})

loadManifest().catch((err) => {
  document
    .getElementById('app')!
    .replaceChildren(
      renderHeader(),
      el(
        'div',
        { class: 'stage' },
        el('div', { class: 'empty' }, `no manifest yet — run vitest first (${String(err)})`),
      ),
    )
})

/** A failed refresh is not worth breaking the page over; the next one may succeed. */
const refresh = () => loadManifest().catch(() => undefined)

if (import.meta.hot) {
  // Dev: the Vite plugin pushes an event whenever the reporter rewrites the manifest.
  import.meta.hot.on('describe-me:update', () => void refresh())
} else {
  // Static site: data only changes on redeploy, so a slow poll is plenty.
  setInterval(() => void refresh(), 60_000)
}
