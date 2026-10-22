import type { SidePanel } from './panel-choice.js'
import { panelShown } from './panel-shown.js'

const KEYS: Record<SidePanel, string> = { sidebar: '[', inspector: ']' }

/** Pressed while its panel shows, and titled with what a click does. */
export function syncPanelToggle(button: HTMLElement): void {
  const panel = button.dataset.panel as SidePanel
  const shown = panelShown(panel)

  button.classList.toggle('on', shown)
  button.setAttribute('aria-expanded', String(shown))
  button.title = `${shown ? 'Hide' : 'Show'} the ${panel} (${KEYS[panel]})`
}
