import type { Frame, FrameKind } from './types.js'

/**
 * The place of one `capture()` call among the test's frames, reserved when it
 * is called. Unfilled while `snapshot` is undefined.
 */
export interface FrameSlot {
  kind: FrameKind
  label: string
  meta?: Record<string, unknown>
  at?: number
  snapshot?: string
}

/**
 * The frames a test hands over, in the order their captures were called.
 * Unfilled slots are left out. A closing frame equal to the frame before it
 * is dropped, and a step equal to the frame before it names that frame
 * instead. The slots are left unchanged.
 */
export function compactFrames(slots: readonly FrameSlot[]): Frame[] {
  const kept: Frame[] = []

  for (const slot of slots) {
    const last = kept.at(-1)

    // The test went on after `cleanup()`, so its closing frame names the state before it.
    if (slot.kind !== 'end' && last?.kind === 'end') {
      last.kind = 'step'
      last.label = 'before cleanup()'
    }

    if (slot.snapshot === undefined) {
      continue
    }

    if (slot.kind === 'end' && last?.snapshot === slot.snapshot) {
      continue
    }

    // A step whose body already produced this exact DOM (e.g. via an action) just names that frame.
    if (slot.kind === 'step' && last?.snapshot === slot.snapshot) {
      last.label = `${slot.label} · ${last.label}`
      last.kind = 'step'
      continue
    }

    kept.push({
      id: `f${kept.length}`,
      kind: slot.kind,
      label: slot.label,
      at: slot.at ?? 0,
      meta: slot.meta,
      snapshot: slot.snapshot,
    })
  }

  return kept
}
