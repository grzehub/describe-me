import { el } from './el.js'
import type { SidePanel } from './panel-choice.js'
import { syncPanelToggle } from './sync-panel-toggle.js'
import { togglePanel } from './toggle-panel.js'

/**
 * The button that hides or shows a panel, drawn like one button of the theme
 * switch. Every view has a pair in its first row, and `showPanels()` keeps
 * them all in step.
 */
export function renderPanelToggle(panel: SidePanel): HTMLElement {
  const button = el('button', {
    type: 'button',
    'data-panel': panel,
    'aria-label': panel,
    'aria-controls': panel,
    click: () => togglePanel(panel),
  })

  syncPanelToggle(button)

  return el('div', { class: 'panel-toggle' }, button)
}
