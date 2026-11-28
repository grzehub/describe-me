import type { FrameChange, Look, TestChange } from './changes-report.js'

/**
 * How a changed test looks, from the looks of its changed frames: `different`
 * when one of them is, `same` when it has at least one, all of them are and
 * no frame was added or removed, since a new step was never compared.
 * `undefined` otherwise, also when a frame did not render.
 */
export function testLook(
  test: TestChange,
  lookOf: (frame: FrameChange) => Look | undefined,
): Look | undefined {
  if (test.change !== 'changed') {
    return undefined
  }

  const looks = test.frames.filter((frame) => frame.change === 'changed').map(lookOf)

  if (looks.includes('different')) {
    return 'different'
  }

  const onlyPairs = looks.length > 0 && looks.length === test.frames.length

  return onlyPairs && looks.every((look) => look === 'same') ? 'same' : undefined
}
