import { el } from './el.js'
import { state } from './state.js'

const SHOWN_ROWS = 10
// A short tail shows in full, so the button never says "Show 1 more".
const MIN_HIDDEN_ROWS = 3

function applyFold(rows: HTMLTableRowElement[], button: HTMLButtonElement, key: string): void {
  const expanded = state.expandedProps.has(key)
  rows.forEach((row, index) => {
    row.hidden = !expanded && index >= SHOWN_ROWS
  })

  button.textContent = expanded ? 'Show fewer' : `Show ${rows.length - SHOWN_ROWS} more`
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false')
}

/**
 * Append the prop rows to `table`, folded to the first few when there are many,
 * with a button under them that unfolds them. `key` names the table in
 * `state.expandedProps`, so a rebuilt table opens as it was left.
 */
export function collapseProps(
  table: HTMLTableElement,
  rows: HTMLTableRowElement[],
  key: string,
): HTMLElement[] {
  table.append(...rows)
  if (rows.length - SHOWN_ROWS < MIN_HIDDEN_ROWS) {
    return [table]
  }

  const button = el('button', { type: 'button', class: 'props-more', 'aria-expanded': 'false' })
  button.addEventListener('click', () => {
    if (state.expandedProps.has(key)) {
      state.expandedProps.delete(key)
    } else {
      state.expandedProps.add(key)
    }

    applyFold(rows, button, key)
    if (!state.expandedProps.has(key)) {
      // The rows above it go away, which can move the button out of view.
      button.scrollIntoView({ block: 'nearest' })
    }
  })

  // Final before insertion, so the overview's scroll restore sees the real height.
  applyFold(rows, button, key)

  return [table, button]
}
