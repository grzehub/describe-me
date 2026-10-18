import { el } from './el.js'

const DEBOUNCE_MS = 50

/**
 * The token filter in the Foundations toolbar. Typing applies after a short
 * pause, as the sidebar search does. Esc clears it and leaves the field, Enter
 * applies it and leaves the field. The query is never part of the link.
 */
export class FoundationsFilter {
  /** The filter of the latest panel, which `/` focuses while Foundations is shown. */
  static current: FoundationsFilter | null = null

  readonly element: HTMLInputElement
  query = ''
  /** Runs when the query changes. */
  changed: () => void = () => {}
  /** Runs after Enter, once the query is applied. */
  entered: () => void = () => {}
  private pending: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.element = el('input', {
      class: 'foundations-filter',
      type: 'search',
      placeholder: 'Filter tokens',
      'aria-label': 'Filter tokens',
    })

    this.element.addEventListener('input', () => {
      clearTimeout(this.pending)
      this.pending = setTimeout(() => this.apply(), DEBOUNCE_MS)
    })

    this.element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.element.value = ''
        this.apply()
        this.element.blur()
        return
      }

      if (event.key === 'Enter') {
        this.apply()
        this.element.blur()
        this.entered()
        event.preventDefault()
      }
    })

    FoundationsFilter.current = this
  }

  focus(): void {
    this.element.focus()
    this.element.select()
  }

  private apply(): void {
    clearTimeout(this.pending)
    this.pending = undefined

    if (this.query !== this.element.value) {
      this.query = this.element.value
      this.changed()
    }
  }
}
