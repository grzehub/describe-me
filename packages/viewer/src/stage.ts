import type { ManifestTest } from '@describe-me/core/types'
import { applyDarkVariant } from './apply-dark-variant.js'
import { applyViewport } from './apply-viewport.js'
import { autoCanvas } from './auto-canvas.js'
import type { Canvas } from './canvas-of.js'
import { canvasOf } from './canvas-of.js'
import { loadSnapshot } from './data.js'
import { el } from './el.js'
import { fontsSettled } from './fonts-settled.js'
import { liveSession } from './live-session.js'
import { liveShown } from './live-shown.js'
import { paintLive } from './paint-live.js'
import { replaySnapshot } from './replay-snapshot.js'
import { stageDarkVariant } from './stage-dark-variant.js'
import { stageDarkVariantReady } from './stage-dark-variant-ready.js'
import { renderStageNote } from './stage-note.js'
import { currentTest, state } from './state.js'
import { syncLiveDarkVariant } from './sync-live-dark-variant.js'
import { testView } from './test-view.js'
import { renderViewportControls } from './viewport-controls.js'

/** How long a built frame waits for its fonts before it is swapped in anyway. */
const SWAP_TIMEOUT_MS = 200

/** Bumped by every paint, so a paint that was overtaken drops its slot. */
let paintToken = 0
let observer: ResizeObserver | null = null

/**
 * What `auto` meant for the last recorded frame swapped in. Live uses it,
 * because the viewer never reads the live page. Under `describe-me dev` it
 * cannot, and a static site behaves the same.
 */
let lastAuto: 'light' | 'dark' = 'light'

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

/** The underlay under a loading live frame never counts, so leaving Live swaps a frame in. */
function visibleSlot(frames: HTMLElement): HTMLElement | null {
  return frames.querySelector<HTMLElement>(
    ':scope > .stage-slot:not(.incoming):not(.live-underlay)',
  )
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

/** A slot's own `auto`, or the last one for Live and for a frame not measured yet. */
function autoOf(slot: HTMLElement | null): 'light' | 'dark' {
  const auto = slot?.dataset.auto
  if (auto === 'light' || auto === 'dark') {
    return auto
  }

  return lastAuto
}

/** The iframe's scheme decides `prefers-color-scheme` inside the frame. */
function setFrameScheme(iframe: HTMLIFrameElement, canvas: Canvas): void {
  iframe.style.colorScheme = canvas === 'dark' ? 'dark' : 'light'
}

/** A recorded frame is same-origin, so the variant goes on its root directly. */
function setFrameVariant(iframe: HTMLIFrameElement): void {
  if (iframe.contentDocument) {
    applyDarkVariant(iframe.contentDocument, stageDarkVariant())
  }
}

function shows(slot: HTMLElement | null, shown: Shown): boolean {
  return (
    slot?.dataset.generatedAt === shown.generatedAt &&
    slot.dataset.test === shown.testId &&
    slot.dataset.frame === String(shown.frame)
  )
}

/**
 * Re-apply the background, its dark variant and the viewport to every slot,
 * then sync the stage's canvas and the toolbar.
 */
function refit(stage: HTMLElement, frames: HTMLElement): void {
  for (const slot of frames.querySelectorAll<HTMLElement>(':scope > .stage-slot')) {
    const iframe = slot.querySelector('iframe')
    const live = slot.classList.contains('live-slot')
    const liveHeight = live ? liveSession.height : undefined
    // `autoCanvas()` reads a new frame as recorded, so its scheme and variant wait until it has.
    const measured = !slot.classList.contains('incoming') || slot.dataset.auto !== undefined

    if (iframe && measured) {
      setFrameScheme(iframe, canvasOf(autoOf(slot)))

      // The live page may run on another origin, so it only ever gets a message.
      if (live) {
        syncLiveDarkVariant(slot)
      } else {
        setFrameVariant(iframe)
      }
    }

    if (iframe) {
      state.scale = applyViewport(slot, iframe, stage, liveHeight)
    }
  }

  stage.dataset.canvas = canvasOf(autoOf(visibleSlot(frames)))
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

function showEmpty(stage: HTMLElement, frames: HTMLElement, message: string): void {
  ++paintToken
  removeAllBut(frames, null)
  frames.append(el('div', { class: 'empty' }, message))
  stage.dataset.canvas = canvasOf(lastAuto)
  state.scale = 1
  renderViewportControls()
  renderStageNote(null)
}

/** Live takes the stage. A snapshot still loading must not swap in over it. */
function showLive(stage: HTMLElement, frames: HTMLElement, test: ManifestTest): void {
  ++paintToken
  removeIncoming(frames)
  paintLive(stage, frames, test)
  refit(stage, frames)
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

  // A link with `bg=dark` never swaps the light variant in first.
  const [node] = await Promise.all([loadSnapshot(snapshot), stageDarkVariantReady()])
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

  // Measured with the final scheme and variant, which may change the page's rules and so its height.
  const auto = autoCanvas(iframe)
  incoming.dataset.auto = auto
  setFrameScheme(iframe, canvasOf(auto))
  setFrameVariant(iframe)

  const scale = applyViewport(incoming, iframe, stage)

  await Promise.race([fonts, delay(SWAP_TIMEOUT_MS)])
  if (token !== paintToken || !incoming.isConnected) {
    incoming.remove()
    return
  }

  const previousTest = visibleSlot(frames)?.dataset.test
  removeAllBut(frames, incoming)
  // In the task of the swap, so the new canvas never shows next to the old frame.
  lastAuto = auto
  stage.dataset.canvas = canvasOf(auto)
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
 * Show the current frame on the stage, or the test live. A new frame is built
 * in a hidden slot next to the visible one and swapped in once its fonts load,
 * or after 200 ms, so the stage never goes blank. Leaving Live takes the same
 * path, and the swap removes the live slot.
 */
export async function paintStage(): Promise<void> {
  const { stage, frames } = testView()
  observeStage(stage, frames)

  const test = currentTest()
  if (!test) {
    showEmpty(stage, frames, 'select a test')
    return
  }

  if (liveShown()) {
    showLive(stage, frames, test)
    return
  }

  const frame = test.frames[state.frame]
  if (!frame) {
    showEmpty(stage, frames, 'no frames recorded for this test')
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
