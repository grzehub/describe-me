import { compactFrames, type FrameSlot } from './compact-frames.js'
import { pageHasContent } from './page-has-content.js'
import { PendingRender } from './pending-render.js'
import { realTimers } from './real-timers.js'
import { serializeDocument } from './serialize-document.js'
import { settle } from './settle.js'
import {
  ANONYMOUS_COMPONENT,
  type CaptureOptions,
  type ComponentInfo,
  type FrameKind,
  type RecorderOptions,
  type RenderFrameMode,
  type TestRecord,
} from './types.js'

type Teardown = () => void

/**
 * Bump it whenever the contract between the recorder and the adapters or setup
 * files changes: a method or property added, removed or changed in meaning.
 */
const RECORDER_PROTOCOL = 1

type DeferredMode = Exclude<RenderFrameMode, 'eager'>

function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector)

    return true
  } catch {
    return false
  }
}

/**
 * Test-side recorder, running wherever the tests run: the browser-mode iframe
 * or jsdom. `begin()` in beforeEach. `flush()`, the closing capture, `end()`
 * then `teardown()` in afterEach. Framework adapters call `capture()`,
 * `beforeInteraction()`, `setComponent()` and `onTeardown()`.
 */
class Recorder {
  /** Which contract this recorder follows, so another copy of core can refuse it. */
  readonly protocol = RECORDER_PROTOCOL
  // One per capture, in call order, so a frame sits where it was asked for.
  private slots: FrameSlot[] = []
  private currentGeneration = 0
  private inFlight = new Set<Promise<void>>()
  // The render frame `renderFrame` holds back, until an interaction or `flush()` takes it.
  private deferred: FrameSlot | null = null
  private pending: PendingRender | null = null
  private renderFrame: RenderFrameMode = 'eager'
  private component?: ComponentInfo
  private startedAt = 0
  private active = false
  // Once `cleanup()` or the setup file took the closing frame, a second one is skipped.
  private closed = false
  private teardowns = new Set<Teardown>()

  begin(): void {
    this.currentGeneration++
    this.slots = []
    this.inFlight.clear()
    this.clearDeferred()
    this.component = undefined
    this.startedAt = realTimers.now()
    this.active = true
    this.closed = false
  }

  get isActive(): boolean {
    return this.active
  }

  /**
   * Changes with every test. An interaction reads it when it begins and hands
   * it to `capture()`.
   */
  get generation(): number {
    return this.currentGeneration
  }

  /**
   * Choose when the render frame is taken, from the next render capture on.
   * The setup files call it with the plugin's options. A `pending` selector
   * the DOM rejects falls back to `'lazy'` with a warning.
   */
  configure(options: RecorderOptions): void {
    const renderFrame = options.renderFrame ?? 'eager'

    if (
      typeof renderFrame === 'object' &&
      typeof document !== 'undefined' &&
      !isValidSelector(renderFrame.pending)
    ) {
      console.warn(
        `describe-me: renderFrame.pending is not a valid CSS selector: "${renderFrame.pending}". Render frames fall back to 'lazy'.`,
      )

      this.renderFrame = 'lazy'
      return
    }

    this.renderFrame = renderFrame
  }

  /**
   * Name the component the test documents. The first name stays, unless it is
   * `Anonymous` and `info` is not, or it has no `file` and `info` has one.
   */
  setComponent(info: ComponentInfo): void {
    const current = this.component
    const addsFile = current?.file === undefined && info.file !== undefined
    const namesAnonymous =
      current?.name === ANONYMOUS_COMPONENT && info.name !== ANONYMOUS_COMPONENT

    if (!current || namesAnonymous || addsFile) {
      this.component = info
    }
  }

  async capture(
    kind: FrameKind,
    label: string,
    meta?: Record<string, unknown>,
    options: CaptureOptions = {},
  ): Promise<void> {
    if (!this.active) {
      return
    }

    const generation = options.generation ?? this.currentGeneration

    // The interaction began in a test that has ended.
    if (generation !== this.currentGeneration) {
      return
    }

    // A call site that forgot `beforeInteraction()` still gets its render frame here.
    this.beforeInteraction()

    if (kind !== 'end') {
      this.closed = false
    }

    // Before any `await`, so a test that recorded nothing costs nothing.
    if (kind === 'end' && (this.slots.length === 0 || this.closed)) {
      return
    }

    if (kind === 'end') {
      this.closed = true
    }

    const slot: FrameSlot = { kind, label, meta }
    this.slots.push(slot)

    if (kind === 'render' && this.renderFrame !== 'eager') {
      this.defer(slot, this.renderFrame)
      return
    }

    // Filled before `capture()` returns: Testing Library frames depend on it.
    if (options.settle === false) {
      this.fill(slot)
      return
    }

    const filling = this.settleThenFill(slot, generation)
    this.inFlight.add(filling)

    try {
      await filling
    } finally {
      this.inFlight.delete(filling)
    }
  }

  /**
   * Take a deferred render frame now. Adapters call it before an interaction
   * changes the page: an event, a `step()` body, another render, an unmount.
   */
  beforeInteraction(): void {
    const slot = this.deferred

    if (slot === null) {
      return
    }

    this.clearDeferred()
    this.fill(slot)
  }

  /**
   * Wait for the captures in flight, then take a deferred render frame after
   * one settle. Resolves to whether it took a deferred render frame.
   */
  async flush(): Promise<boolean> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled(this.inFlight)
    }

    const slot = this.deferred

    // Nothing to settle for, so empty and eager tests stay free.
    if (slot === null) {
      return false
    }

    const generation = this.currentGeneration

    await settle()

    // The test ended, or an interaction took the frame, while this settled.
    if (generation !== this.currentGeneration || this.deferred !== slot) {
      return false
    }

    this.beforeInteraction()

    return true
  }

  end(): TestRecord {
    this.active = false
    this.currentGeneration++
    this.clearDeferred()

    // The reporter needs the origin rrweb resolved every URL against. Optional
    // chaining, because a DOM environment is not guaranteed to define `location`.
    return {
      frames: compactFrames(this.slots),
      component: this.component,
      origin: globalThis.location?.origin,
    }
  }

  /**
   * Register work that must run after the test's frames are handed over, such
   * as unmounting. Adapters call this once at import; registering the same
   * callback again is a no-op.
   */
  onTeardown(callback: Teardown): void {
    this.teardowns.add(callback)
  }

  /** Run the registered teardowns. Called by the runner integration after `end()`. */
  teardown(): void {
    for (const callback of this.teardowns) {
      callback()
    }
  }

  /**
   * Hold the render frame back until `mode` allows it. `capture()` already
   * took any earlier one.
   */
  private defer(slot: FrameSlot, mode: DeferredMode): void {
    if (mode === 'lazy') {
      this.deferred = slot
      return
    }

    if (PendingRender.isReady(mode.pending)) {
      this.fill(slot)
      return
    }

    this.deferred = slot

    // Without an observer the frame waits like in lazy mode.
    if (typeof MutationObserver !== 'undefined') {
      this.pending = new PendingRender(mode.pending, mode.timeout, () => this.beforeInteraction())
    }
  }

  private clearDeferred(): void {
    this.deferred = null
    this.pending?.dispose()
    this.pending = null
  }

  private async settleThenFill(slot: FrameSlot, generation: number): Promise<void> {
    await settle()

    if (generation === this.currentGeneration) {
      this.fill(slot)
    }
  }

  private fill(slot: FrameSlot): void {
    // After `cleanup()` or `unmount()` there is nothing left to show.
    if (slot.kind === 'end' && !pageHasContent()) {
      return
    }

    const snapshot = serializeDocument()

    if (snapshot === null) {
      return
    }

    slot.snapshot = snapshot
    slot.at = Math.round(realTimers.now() - this.startedAt)
  }
}

const RECORDER_KEY = Symbol.for('describe-me.recorder')

// Another copy of core may have stored anything here.
type GlobalWithRecorder = typeof globalThis & { [RECORDER_KEY]?: unknown }

function protocolOf(existing: unknown): number | undefined {
  if (typeof existing !== 'object' || existing === null) {
    return undefined
  }

  const candidate = existing as { protocol?: unknown; flush?: unknown }

  if (typeof candidate.protocol === 'number') {
    return candidate.protocol
  }

  // 0.5.0 did not stamp its recorder. It is the first version with `flush()`,
  // and its contract is protocol 1.
  if (typeof candidate.flush === 'function') {
    return 1
  }

  return undefined
}

/**
 * The adapter and the setup file may receive two copies of this module: Vite
 * pre-bundles the adapter together with its own copy of core, while a linked
 * workspace serves the setup file's import from source. A module-level
 * singleton would then split into an active recorder and a silent one, and
 * every render frame would go missing. Anchoring it on `globalThis` keeps one
 * recorder per page no matter how the code was bundled.
 */
function sharedRecorder(): Recorder {
  const scope = globalThis as GlobalWithRecorder
  const existing = scope[RECORDER_KEY]

  if (existing === undefined) {
    const created = new Recorder()
    scope[RECORDER_KEY] = created

    return created
  }

  const found = protocolOf(existing)

  if (found !== RECORDER_PROTOCOL) {
    throw new Error(
      `describe-me: all describe-me packages must be on the same version. Another copy of @describe-me/core created the test recorder (protocol ${found ?? 'none'}, expected ${RECORDER_PROTOCOL}). Install @describe-me/core, @describe-me/react, @describe-me/vitest and describe-me at one version.`,
    )
  }

  return existing as Recorder
}

export const recorder = sharedRecorder()
