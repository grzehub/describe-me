import { renderTree } from './render-tree.js'
import { select, state } from './state.js'
import { visibleTests } from './visible-tests.js'

const DEBOUNCE_MS = 50

/**
 * Filter the sidebar as you type. Esc clears the search, Enter or ↓ opens the
 * first match and hands the arrow keys back to the test list.
 */
export function wireSearchField(input: HTMLInputElement): void {
  let pending: ReturnType<typeof setTimeout> | undefined

  const apply = (): void => {
    clearTimeout(pending)
    pending = undefined
    if (state.query !== input.value) {
      state.query = input.value
      renderTree()
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(pending)
    pending = setTimeout(apply, DEBOUNCE_MS)
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = ''
      apply()
      input.blur()
      return
    }

    if (event.key !== 'Enter' && event.key !== 'ArrowDown') {
      return
    }

    apply()
    const first = visibleTests()[0]
    if (first) {
      select(first.id)
    }

    input.blur()
    event.preventDefault()
  })
}
