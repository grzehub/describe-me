import type { ManifestTest } from '@describe-me/core/types'
import { CollapsedSuites } from './collapsed-suites.js'
import { regions } from './regions.js'
import { renderSidebar } from './sidebar.js'
import { currentTest, state } from './state.js'
import { suiteKey } from './suite-key.js'

let revealed: string | null = null

/** Open the test's module and every suite above it, the empty path included. */
function expandPathTo(test: ManifestTest): void {
  const manifest = state.manifest
  const mod = manifest?.modules.find((candidate) => candidate.tests.includes(test))
  if (!manifest || !mod) {
    return
  }

  const prefixes = [[], ...test.path.map((_, i) => test.path.slice(0, i + 1))]
  CollapsedSuites.for(manifest.root).expand(prefixes.map((prefix) => suiteKey(mod.id, prefix)))
}

/**
 * Fill the sidebar's tree. A test selected since the last reveal gets its
 * module and suites opened and its row scrolled into view. A refresh that
 * keeps the test leaves the sidebar's scroll alone.
 */
export function renderTree(): void {
  const { tree } = regions()
  const test = state.suiteKey ? null : currentTest()
  const reveal = test !== null && test.id !== revealed

  // The overview may collapse the test's suites, so coming back to it counts as a new selection.
  if (test === null) {
    revealed = null
  }

  if (test && reveal) {
    expandPathTo(test)
    revealed = test.id
  }

  tree.replaceChildren(...renderSidebar(renderTree))

  if (reveal) {
    tree.querySelector('.test.active')?.scrollIntoView({ block: 'nearest' })
  }
}
