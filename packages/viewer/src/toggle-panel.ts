import { PanelChoice, type SidePanel } from './panel-choice.js'
import { panelShown } from './panel-shown.js'
import { showPanels } from './show-panels.js'
import { state } from './state.js'

/**
 * Hide or show a panel and keep that for the project. `shown` asks for one
 * state, and a panel already in it stays without a choice, so it keeps
 * following the window. The choice belongs to a project, so nothing happens
 * before the manifest has loaded.
 */
export function togglePanel(panel: SidePanel, shown = !panelShown(panel)): void {
  if (!state.manifest || shown === panelShown(panel)) {
    return
  }

  PanelChoice.for(state.manifest.root).set(panel, shown)
  showPanels()
}
