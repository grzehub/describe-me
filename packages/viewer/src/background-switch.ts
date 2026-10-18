import { el } from './el.js'
import type { StageBackground } from './parse-stage-background.js'
import { rerender } from './rerender.js'
import { state, writeHash } from './state.js'

/** Swatches, not words, so the breadcrumb path keeps its room. */
const BACKGROUNDS: { value: StageBackground; title: string }[] = [
  { value: 'auto', title: 'Stage background: auto, follows the page' },
  { value: 'light', title: 'Stage background: light' },
  { value: 'dark', title: 'Stage background: dark' },
  { value: 'transparent', title: 'Stage background: transparent' },
]

/** No history entry, as for every other change of the stage. A test view repaints only its frame. */
function setBackground(background: StageBackground): void {
  state.background = background
  writeHash('replace')
  rerender('frame')
}

/**
 * The stage background switch, which the viewport toolbar and Foundations each
 * hold. Built once and synced in place, so a focused swatch keeps its focus.
 */
export class BackgroundSwitch {
  readonly element: HTMLElement
  private readonly buttons = new Map<StageBackground, HTMLElement>()

  constructor() {
    this.element = el('div', {
      class: 'backgrounds',
      role: 'group',
      'aria-label': 'Stage background',
    })

    for (const background of BACKGROUNDS) {
      const button = el('button', {
        type: 'button',
        'data-bg': background.value,
        'aria-label': background.value,
        title: background.title,
        click: () => setBackground(background.value),
      })

      this.buttons.set(background.value, button)
      this.element.append(button)
    }
  }

  /** Press the swatch of `state.background`. */
  sync(): void {
    for (const [background, button] of this.buttons) {
      const on = background === state.background
      button.classList.toggle('on', on)
      button.setAttribute('aria-pressed', String(on))
    }
  }
}
