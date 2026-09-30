import { applyViewport } from './apply-viewport.js'
import { loadSnapshot } from './data.js'
import { el } from './el.js'
import { fontsSettled } from './fonts-settled.js'
import { replaySnapshot } from './replay-snapshot.js'
import { renderStageNote } from './stage-note.js'
import { currentTest, state } from './state.js'
import { testView } from './test-view.js'
import { renderViewportControls } from './viewport-controls.js'

/** How long a built frame waits for its fonts before it is swapped in anyway. */
const SWAP_TIMEOUT_MS = 200

/** Bumped by every paint, so a paint that was overtaken drops its slot. */
let paintToken = 0
let observer: ResizeObserver | null = null

interface Shown {
  generatedAt: string
  testId: string
  frame: number
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function visibleSlot(frames: HTMLElement): HTMLElement | null {
  return frames.querySelector<HTMLElement>(':scope > .stage-slot:not(.incoming)')
}

function removeIncoming(frames: HTMLElement): void {
  for (const slot of frames.querySelectorAll(':scope > .stage-slot.incoming')) {
    slot.remove()
  }
}

/** Slots leave only through `remove()`. Moving one elsewhere would reload its iframe blank. */
function removeAllBut(frames: HTMLElement, keep: Element | null): void {
  for (const child of Array.from(frames.children)) {
    if (child !== keep) {
      child.remove()
    }
  }
}

function shows(slot: HTMLElement | null, shown: Shown): boolean {
  return (
    slot?.dataset.generatedAt === shown.generatedAt &&
    slot.dataset.test === shown.testId &&
    slot.dataset.frame === String(shown.frame)
  )
}

/** Re-apply the viewport to every slot and sync the zoom label. */
function refit(stage: HTMLElement, frames: HTMLElement): void {
  for (const slot of frames.querySelectorAll<HTMLElement>(':scope > .stage-slot')) {
    const iframe = slot.querySelector('iframe')
    if (iframe) {
      state.scale = applyViewport(slot, iframe, stage)
    }
  }

  renderViewportControls()
}

/** The stage's size comes from the grid, not from its content, so fitting never feeds back. */
function observeStage(stage: HTMLElement, frames: HTMLElement): void {
  if (observer) {
    return
  }

  observer = new ResizeObserver(() => refit(stage, frames))
  observer.observe(stage)
}

function showEmpty(frames: HTMLElement, message: string): void {
  ++paintToken
  removeAllBut(frames, null)
  frames.append(el('div', { class: 'empty' }, message))
  state.scale = 1
  renderViewportControls()
  renderStageNote(null)
}

/** Keep the frame on screen, but settle any paint still in flight for another one. */
function keepFrame(stage: HTMLElement, frames: HTMLElement): void {
  ++paintToken
  removeIncoming(frames)
  refit(stage, frames)
  requestAnimationFrame(() => refit(stage, frames))
}

async function swapIn(
  stage: HTMLElement,
  frames: HTMLElement,
  shown: Shown,
  snapshot: string,
): Promise<void> {
  const token = ++paintToken
  removeIncoming(frames)

  const node = await loadSnapshot(snapshot)
  if (token !== paintToken) {
    return
  }

  // Built in its final place: rrweb needs a connected root, and moving the
  // slot later would reload its iframe. The visible slot's size lets the new
  // iframe lay out at the current width.
  const current = visibleSlot(frames)
  const incoming = el('div', { class: 'stage-slot incoming', 'aria-hidden': 'true' })
  incoming.dataset.generatedAt = shown.generatedAt
  incoming.dataset.test = shown.testId
  incoming.dataset.frame = String(shown.frame)
  incoming.style.width = current?.style.width ?? ''
  incoming.style.height = current?.style.height ?? ''
  frames.append(incoming)

  const iframe = replaySnapshot(incoming, node, 'snapshot')
  const fonts = fontsSettled(iframe)

  // Styles are in place after a frame. Only then do the boxes have their final size.
  await nextAnimationFrame()
  if (token !== paintToken) {
    incoming.remove()
    return
  }

  const scale = applyViewport(incoming, iframe, stage)

  await Promise.race([fonts, delay(SWAP_TIMEOUT_MS)])
  if (token !== paintToken || !incoming.isConnected) {
    incoming.remove()
    return
  }

  const previousTest = visibleSlot(frames)?.dataset.test
  removeAllBut(frames, incoming)
  incoming.classList.remove('incoming')
  incoming.removeAttribute('aria-hidden')

  if (previousTest !== shown.testId) {
    stage.scrollTo(0, 0)
  }

  state.scale = scale
  renderViewportControls()

  // Web fonts that arrive after the swap change the text's size. The note is
  // not cleared at the swap, so frames that share a failure do not flicker.
  const failures = await fonts
  if (token === paintToken) {
    refit(stage, frames)
    renderStageNote(failures)
  }
}

/**
 * Show the current frame on the stage. A new frame is built in a hidden slot
 * next to the visible one and swapped in once its fonts load, or after 200 ms,
 * so the stage never goes blank.
 */
export async function paintStage(): Promise<void> {
  const { stage, frames } = testView()
  observeStage(stage, frames)

  const test = currentTest()
  if (!test) {
    showEmpty(frames, 'select a test')
    return
  }

  const frame = test.frames[state.frame]
  if (!frame) {
    showEmpty(frames, 'no frames recorded for this test')
    return
  }

  const shown = {
    generatedAt: state.manifest?.generatedAt ?? '',
    testId: test.id,
    frame: state.frame,
  }

  if (shows(visibleSlot(frames), shown)) {
    keepFrame(stage, frames)
    return
  }

  await swapIn(stage, frames, shown, frame.snapshot)
}
