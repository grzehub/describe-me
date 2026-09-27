import type { FrameKind } from '@describe-me/core/types'

export function isRecordedTest(test: { frames: readonly { kind: FrameKind }[] }): boolean {
  return test.frames.some((frame) => frame.kind !== 'end')
}
