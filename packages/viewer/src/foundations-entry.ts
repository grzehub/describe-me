import { el } from './el.js'
import { foundationsRetry } from './foundations-retry.js'
import { openFoundations, state } from './state.js'
import { systemName } from './system-name.js'

let built: { button: HTMLElement; systems: HTMLElement } | null = null

function build(nav: HTMLElement): { button: HTMLElement; systems: HTMLElement } {
  const systems = el('span', { class: 'foundations-systems' })
  const button = el(
    'button',
    {
      type: 'button',
      class: 'foundations-entry',
      click: () => {
        foundationsRetry.requested = true
        openFoundations(state.foundations ?? 'colors', 'push')
      },
    },
    el('span', { class: 'foundations-title' }, 'Foundations'),
    systems,
  )

  nav.replaceChildren(button)

  return { button, systems }
}

/**
 * Fill the sidebar's Foundations entry, which names the design systems and is
 * hidden unless the manifest has tokens. Built once and synced in place, so a
 * focused entry keeps its focus.
 */
export function renderFoundationsEntry(nav: HTMLElement): void {
  const summary = state.manifest?.foundations
  nav.hidden = !summary || summary.tokens <= 0

  if (!summary || nav.hidden) {
    return
  }

  built ??= build(nav)

  const names = summary.systems.map((id) => systemName(id))
  built.systems.textContent = names.length > 0 ? names.join(' · ') : 'custom properties'

  const open = state.foundations !== null
  built.button.classList.toggle('active', open)

  if (open) {
    built.button.setAttribute('aria-current', 'page')
  } else {
    built.button.removeAttribute('aria-current')
  }
}
