import { panelShown } from './panel-shown.js'
import { regions } from './regions.js'
import { syncPanelToggle } from './sync-panel-toggle.js'

/**
 * Hide or show the sidebar with its edge and the inspector, as the reader
 * chose or the window allows, and sync every toggle on the page. Cheap and
 * idempotent, so every repaint and every resize can call it.
 */
export function showPanels(): void {
  const { columns, sidebar, sidebarHandle, inspector } = regions()
  const sidebarShown = panelShown('sidebar')
  const inspectorShown = panelShown('inspector')

  sidebar.hidden = !sidebarShown
  sidebarHandle.hidden = !sidebarShown
  inspector.hidden = !inspectorShown
  columns.classList.toggle('sidebar-hidden', !sidebarShown)
  columns.classList.toggle('inspector-hidden', !inspectorShown)

  for (const button of document.querySelectorAll<HTMLElement>('.panel-toggle button')) {
    syncPanelToggle(button)
  }
}
