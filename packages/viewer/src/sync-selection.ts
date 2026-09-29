import { resolveTestId } from './resolve-test-id.js'
import { stateHash } from './state-hash.js'
import { allTests, currentTest, state, writeHash } from './state.js'

/**
 * Point the selection at a test the manifest holds, falling back to the first
 * one, and clamp the frame. The link is corrected in place, without a history
 * entry. Does not repaint.
 */
export function syncSelection(): void {
  if (!state.manifest) {
    return
  }

  const resolved = resolveTestId(state.manifest, state.testId)
  if (resolved) {
    state.testId = resolved
  } else {
    state.testId = allTests(state.manifest)[0]?.id ?? null
    state.frame = 0
  }

  const test = currentTest()
  if (test) {
    state.frame = Math.min(state.frame, Math.max(0, test.frames.length - 1))
  }

  if (stateHash(state) !== location.hash.slice(1)) {
    writeHash('replace')
  }
}
