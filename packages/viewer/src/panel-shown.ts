import { PanelChoice, type SidePanel } from './panel-choice.js'
import { state } from './state.js'

/** The narrowest window that shows each panel until the reader chooses. */
const MIN_WINDOW: Record<SidePanel, number> = { sidebar: 800, inspector: 1100 }

/** Whether the panel shows: the reader's choice for the project, else the window's width. */
export function panelShown(panel: SidePanel): boolean {
  const chosen = state.manifest ? PanelChoice.for(state.manifest.root).get(panel) : undefined

  return chosen ?? window.innerWidth >= MIN_WINDOW[panel]
}
