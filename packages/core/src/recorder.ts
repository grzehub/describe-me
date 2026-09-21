import { snapshot, createMirror } from 'rrweb-snapshot'
import { materializeAdoptedStyles } from './materialize-adopted-styles.js'
import { quickHash } from './quick-hash.js'
import { settle } from './settle.js'
import type { ComponentInfo, Frame, FrameKind, TestRecord } from './types.js'

/**
 * Browser-side recorder. One instance per test iframe; `begin()` in beforeEach,
 * `end()` in afterEach. Framework adapters call `capture()` and `setComponent()`.
 */
class Recorder {
  private frames: Frame[] = []
  private component?: ComponentInfo
  private startedAt = 0
  private active = false
  private lastHash = ''
  private seq = 0

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

  async capture(kind: FrameKind, label: string, meta?: Record<string, unknown>): Promise<void> {
    if (!this.active) {
      return
    }

    await settle()
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
}

export const recorder = new Recorder()
