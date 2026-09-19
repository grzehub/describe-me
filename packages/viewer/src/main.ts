/// <reference types="vite/client" />
import { loadManifest } from './data.js'
import { h } from './h.js'
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
      h(
        'div',
        { class: 'stage' },
        h('div', { class: 'empty' }, `no manifest yet — run vitest first (${String(err)})`),
      ),
    )
})

if (import.meta.hot) {
  import.meta.hot.on('describe-me:update', () => void loadManifest())
} else {
  setInterval(() => void loadManifest(), 3000)
}
