import type { ManifestTest } from '@describe-me/core/types'
import { el } from './el.js'
import { liveSession } from './live-session.js'
import { liveSrc } from './live-src.js'
import { resetLiveSession } from './reset-live-session.js'
import { state } from './state.js'

/** The fade of the live frame and of the underlay. Matches the transitions in `style.css`. */
const FADE_MS = 150

/** The live slot on the stage, when it shows `src` and no Restart came since. */
function keptSlot(frames: HTMLElement, src: string): HTMLElement | null {
  const slot = frames.querySelector<HTMLElement>(':scope > .live-slot')
  const shown = slot?.querySelector('iframe')?.getAttribute('src')

  return shown === src && slot?.dataset.restart === String(liveSession.restarts) ? slot : null
}

/** No `sandbox`: the live page runs the component, its scripts and its timers. */
function buildSlot(test: ManifestTest, src: string): HTMLElement {
  const iframe = el('iframe', { src, title: `${test.fullName}, live` })
  const slot = el('div', { class: 'stage-slot live-slot loading' }, iframe)

  // Never `generatedAt` or `frame`, so the stage never takes it for a recorded frame.
  slot.dataset.test = test.id
  slot.dataset.restart = String(liveSession.restarts)

  return slot
}

/**
 * The slot that stays under the live frame of `test` while it loads: the one
 * already there, or, for a new live frame, the recorded frame of the same test
 * turned into one in place. A frame of another test never stays.
 */
function pickUnderlay(frames: HTMLElement, test: ManifestTest, built: boolean): HTMLElement | null {
  const underlay = frames.querySelector<HTMLElement>(':scope > .live-underlay')

  if (underlay?.dataset.test === test.id) {
    return underlay
  }

  const recorded = frames.querySelector<HTMLElement>(
    ':scope > .stage-slot[data-frame]:not(.incoming)',
  )

  if (!built || recorded?.dataset.test !== test.id) {
    return null
  }

  // Without `frame` the stage never takes it for a recorded frame, and `data-auto`
  // keeps its scheme. `inert`, because a dimmed iframe paints above the live one.
  recorded.classList.add('live-underlay')
  recorded.inert = true
  delete recorded.dataset.frame
  delete recorded.dataset.generatedAt

  return recorded
}

/**
 * End the loading state once the live page reported a status, whatever it is.
 * Every paint runs it, and a timer rather than `transitionend` removes the
 * underlay, because reduced motion has no transition to end.
 */
function settle(slot: HTMLElement, underlay: HTMLElement | null): void {
  const loading = liveSession.status === 'loading'

  slot.classList.toggle('loading', loading)

  if (loading || !underlay || underlay.classList.contains('leaving')) {
    return
  }

  underlay.classList.add('leaving')
  setTimeout(() => underlay.remove(), FADE_MS)
}

/**
 * Put the live slot of `test` on the stage. A slot that already shows the same
 * page stays, so a size change, an overview or a manifest reload keeps the
 * component's state. A new test, a Restart or another base builds a new frame
 * with a fresh session. A new frame loads see-through over the dimmed recorded
 * frame of the same test, until its page reports a status.
 */
export function paintLive(stage: HTMLElement, frames: HTMLElement, test: ManifestTest): void {
  const base = state.preview.base
  const src = base && state.manifest ? liveSrc(base, state.manifest, test) : null

  if (src === null) {
    return
  }

  const kept = keptSlot(frames, src)
  const slot = kept ?? buildSlot(test, src)
  const underlay = pickUnderlay(frames, test, kept === null)
  const previousTest = frames.querySelector<HTMLElement>(':scope > .stage-slot')?.dataset.test

  // Slots leave only through `remove()`. Moving one elsewhere would reload its iframe blank.
  for (const child of Array.from(frames.children)) {
    if (child !== slot && child !== underlay) {
      child.remove()
    }
  }

  if (kept) {
    settle(slot, underlay)
    return
  }

  resetLiveSession(test.id)
  frames.append(slot)
  settle(slot, underlay)

  if (previousTest !== test.id) {
    stage.scrollTo(0, 0)
  }
}
