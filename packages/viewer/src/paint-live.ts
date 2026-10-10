import type { ManifestTest } from '@describe-me/core/types'
import { el } from './el.js'
import { liveSession } from './live-session.js'
import { liveSrc } from './live-src.js'
import { resetLiveSession } from './reset-live-session.js'
import { state } from './state.js'

/** The live slot on the stage, when it shows `src` and no Restart came since. */
function keptSlot(frames: HTMLElement, src: string): HTMLElement | null {
  const slot = frames.querySelector<HTMLElement>(':scope > .live-slot')
  const shown = slot?.querySelector('iframe')?.getAttribute('src')

  return shown === src && slot?.dataset.restart === String(liveSession.restarts) ? slot : null
}

/** No `sandbox`: the live page runs the component, its scripts and its timers. */
function buildSlot(test: ManifestTest, src: string): HTMLElement {
  const iframe = el('iframe', { src, title: `${test.fullName}, live` })
  const slot = el('div', { class: 'stage-slot live-slot' }, iframe)

  // Never `generatedAt` or `frame`, so the stage never takes it for a recorded frame.
  slot.dataset.test = test.id
  slot.dataset.restart = String(liveSession.restarts)

  return slot
}

/**
 * Put the live slot of `test` on the stage, alone. A slot that already shows
 * the same page stays, so a size change, an overview or a manifest reload
 * keeps the component's state. A new test, a Restart or another base builds
 * a new frame with a fresh session.
 */
export function paintLive(stage: HTMLElement, frames: HTMLElement, test: ManifestTest): void {
  const base = state.preview.base
  const src = base && state.manifest ? liveSrc(base, state.manifest, test) : null

  if (src === null) {
    return
  }

  const kept = keptSlot(frames, src)
  const slot = kept ?? buildSlot(test, src)
  const previousTest = frames.querySelector<HTMLElement>(':scope > .stage-slot')?.dataset.test

  // Slots leave only through `remove()`. Moving one elsewhere would reload its iframe blank.
  for (const child of Array.from(frames.children)) {
    if (child !== slot) {
      child.remove()
    }
  }

  if (kept) {
    return
  }

  resetLiveSession(test.id)
  frames.append(slot)

  if (previousTest !== test.id) {
    stage.scrollTo(0, 0)
  }
}
