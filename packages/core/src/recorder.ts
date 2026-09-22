import { snapshot, createMirror } from 'rrweb-snapshot'
import { materializeAdoptedStyles } from './materialize-adopted-styles.js'
import { quickHash } from './quick-hash.js'
import { settle } from './settle.js'
import type { CaptureOptions, ComponentInfo, Frame, FrameKind, TestRecord } from './types.js'

type Teardown = () => void

/**
 * Test-side recorder, running wherever the tests run: the browser-mode iframe
 * or jsdom. `begin()` in beforeEach, `end()` then `teardown()` in afterEach.
 * Framework adapters call `capture()`, `setComponent()` and `onTeardown()`.
 */
class Recorder {
  private frames: Frame[] = []
  private component?: ComponentInfo
  private startedAt = 0
  private active = false
  private lastHash = ''
  private seq = 0
  private teardowns = new Set<Teardown>()

  begin(): void {
    this.frames = []
    this.component = undefined
    this.startedAt = performance.now()
    this.active = true
    this.lastHash = ''
    this.seq = 0
  }

  get isActive(): boolean {
    return this.active
  }

  setComponent(info: ComponentInfo): void {
    if (!this.component) {
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

    if (options.settle !== false) {
      await settle()
    }

    const node = await materializeAdoptedStyles(() =>
      snapshot(document, { mirror: createMirror(), inlineStylesheet: true }),
    )

    if (!node) {
      return
    }

    // rrweb numbers nodes with a global counter, so ids differ between otherwise identical captures.
    const hash = quickHash(
      JSON.stringify(node, (key, value) => (key === 'id' || key === 'rootId' ? undefined : value)),
    )

    // The closing frame is only interesting if something changed since the last one.
    if (kind === 'end' && hash === this.lastHash) {
      return
    }

    // A step whose body already produced this exact DOM (e.g. via an action) just names that frame.
    if (kind === 'step' && hash === this.lastHash && this.frames.length) {
      const last = this.frames[this.frames.length - 1]
      last.label = `${label} · ${last.label}`
      last.kind = 'step'
      return
    }

    this.lastHash = hash
    this.frames.push({
      id: `f${this.seq++}`,
      kind,
      label,
      at: Math.round(performance.now() - this.startedAt),
      meta,
      snapshot: node,
    })
  }

  end(): TestRecord {
    this.active = false
    return { frames: this.frames, component: this.component }
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
}

const RECORDER_KEY = Symbol.for('describe-me.recorder')

type GlobalWithRecorder = typeof globalThis & { [RECORDER_KEY]?: Recorder }

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
  scope[RECORDER_KEY] ??= new Recorder()

  return scope[RECORDER_KEY]
}

export const recorder = sharedRecorder()
