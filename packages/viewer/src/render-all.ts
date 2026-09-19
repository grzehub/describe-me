import { h } from './h.js'
import { renderHeader } from './header.js'
import { renderInspector } from './inspector.js'
import { renderMain } from './main-panel.js'
import { renderSidebar } from './sidebar.js'

/** Repaint the whole app from `state`. */
export function renderAll(): void {
  const app = document.getElementById('app')!
  app.replaceChildren(
    renderHeader(),
    h('div', { class: 'body' }, renderSidebar(), renderMain(), renderInspector()),
  )
}
