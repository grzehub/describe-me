import type { Manifest, ManifestTest } from '@describe-me/core/types'
import { filterActive } from './filter-active.js'
import { resolveTestId } from './resolve-test-id.js'
import { stateHash } from './state-hash.js'
import { allTests, currentTest, state, writeHash } from './state.js'
import { visibleTests } from './visible-tests.js'

/**
 * The first test, or the first a filter leaves, so a link with only a tag
 * opens one of its tests.
 */
function firstTest(manifest: Manifest): ManifestTest | undefined {
  const shown = filterActive() ? visibleTests() : []

  return shown[0] ?? allTests(manifest)[0]
}

/**
 * Point the selection at a test the manifest holds, falling back to the first
 * one the search and the tag leave, and clamp the frame. The link is corrected
 * in place, without a history entry. Does not repaint.
 */
export function syncSelection(): void {
  if (!state.manifest) {
    return
  }

  const resolved = resolveTestId(state.manifest, state.testId)
  if (resolved) {
    state.testId = resolved
  } else {
    state.testId = firstTest(state.manifest)?.id ?? null
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
