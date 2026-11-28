import { el } from './el.js'
import type { FrameSides } from './frame-sides.js'
import { frameSides } from './frame-sides.js'
import { showSide } from './show-side.js'
import { state } from './state.js'

type Side = 'before' | 'after'

interface SideText {
  side: Side
  text: string
  title: string
  /** The title when the frame has no such side. */
  missing: string
}

const SIDES: SideText[] = [
  {
    side: 'before',
    text: 'Before',
    title: 'Before: the frame in the base run (B)',
    missing: 'The base has no such frame',
  },
  {
    side: 'after',
    text: 'After',
    title: 'After: the frame in this run (B)',
    missing: 'This run has no such frame',
  },
]

/** A removed frame shows its Before side, a changed frame the side picked. */
function shownSide(sides: FrameSides): Side {
  return !sides.after || (state.before && sides.before !== null) ? 'before' : 'after'
}

function hasSide(sides: FrameSides, side: Side): boolean {
  return side === 'before' ? sides.before !== null : sides.after
}

/**
 * The Before / After switch of the viewport toolbar, for a frame that differs
 * from the base. Built once and synced in place, so a focused button keeps
 * its focus.
 */
export class BeforeAfterSwitch {
  readonly element: HTMLElement
  private readonly buttons: { text: SideText; button: HTMLElement }[] = []

  constructor() {
    this.element = el('div', {
      class: 'before-after',
      role: 'group',
      'aria-label': 'Compare with the base',
    })

    for (const text of SIDES) {
      const button = el(
        'button',
        { type: 'button', 'data-side': text.side, click: () => showSide(text.side) },
        text.text,
      )

      this.buttons.push({ text, button })
      this.element.append(button)
    }
  }

  /**
   * Hidden unless `frameSides()` has sides, else presses the side shown. A
   * side the frame lacks says so in its title. `aria-disabled` rather than
   * `disabled`, so every browser shows that title.
   */
  sync(): void {
    const sides = frameSides()

    this.element.hidden = sides === null

    if (sides === null) {
      return
    }

    const shown = shownSide(sides)

    for (const { text, button } of this.buttons) {
      const on = text.side === shown
      const available = hasSide(sides, text.side)

      button.classList.toggle('on', on)
      button.setAttribute('aria-pressed', String(on))
      button.title = available ? text.title : text.missing

      if (available) {
        button.removeAttribute('aria-disabled')
      } else {
        button.setAttribute('aria-disabled', 'true')
      }
    }
  }
}
