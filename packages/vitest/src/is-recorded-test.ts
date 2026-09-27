import type { FrameKind } from '@describe-me/core/types'

/**
 * Whether a test belongs in the manifest: it recorded a frame besides the
 * closing one. Takes a `TestRecord` or a `ManifestTest`, so it also rejects the
 * end-only tests that 0.4 wrote for tests that rendered nothing.
 */
export function isRecordedTest(test: { frames: readonly { kind: FrameKind }[] }): boolean {
  return test.frames.some((frame) => frame.kind !== 'end')
}
