import { el } from './el.js'
import { renderHeader } from './header.js'
import { renderInspector } from './inspector.js'
import { renderMain } from './main-panel.js'
import { renderOverview } from './overview.js'
import { renderOverviewInspector } from './overview-inspector.js'
import { renderSidebar } from './sidebar.js'
import { state } from './state.js'

/** Repaint the whole app from `state`: the overview when a suite is selected, else one test. */
export function renderAll(): void {
  const app = document.getElementById('app')!
  const main = state.suiteKey ? renderOverview() : renderMain()
  const aside = state.suiteKey ? renderOverviewInspector() : renderInspector()

  app.replaceChildren(renderHeader(), el('div', { class: 'body' }, renderSidebar(), main, aside))
}
