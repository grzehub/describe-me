import type { ManifestTest } from '@describe-me/core/types'
import { changesFilterBar } from './changes-filter-bar.js'
import { CollapsedSuites } from './collapsed-suites.js'
import { renderFoundationsEntry } from './foundations-entry.js'
import { groupKey } from './group-key.js'
import { regions } from './regions.js'
import { renderSidebar } from './sidebar.js'
import { currentTest, state } from './state.js'
import { suiteKey } from './suite-key.js'
import { tagFilterBar } from './tag-filter-bar.js'
import { testShown } from './test-shown.js'

let revealed: string | null = null

/**
 * Open the groups of the test's module, the module and every suite above the
 * test, the empty path included.
 */
function expandPathTo(test: ManifestTest): void {
  const manifest = state.manifest
  const mod = manifest?.modules.find((candidate) => candidate.tests.includes(test))
  if (!manifest || !mod) {
    return
  }

  const group = mod.group ?? []
  const groups = group.map((_, i) => groupKey(group.slice(0, i + 1)))
  const prefixes = [[], ...test.path.map((_, i) => test.path.slice(0, i + 1))]

  CollapsedSuites.for(manifest.root).expand([
    ...groups,
    ...prefixes.map((prefix) => suiteKey(mod.id, prefix)),
  ])
}

/**
 * Fill the sidebar's tree, and above it the Changed filter, the tag filter and
 * the Foundations entry, which no filter hides. A test selected since the last
 * reveal gets its groups, module and suites opened and its row scrolled into
 * view. A refresh that keeps the test leaves the sidebar's scroll alone.
 */
export function renderTree(): void {
  const { changesFilter, tagFilter, foundationsNav, tree } = regions()
  const test = testShown() ? currentTest() : null
  const reveal = test !== null && test.id !== revealed

  // The overview may collapse the test's suites, so coming back to it counts as a new selection.
  if (test === null) {
    revealed = null
  }

  if (test && reveal) {
    expandPathTo(test)
    revealed = test.id
  }

  const toggle = changesFilterBar()
  // The toggle repaints the sidebar it sits in, and a keyboard user keeps their place on it.
  const focused = changesFilter.contains(document.activeElement)

  changesFilter.replaceChildren(...toggle)
  changesFilter.hidden = toggle.length === 0

  if (focused) {
    toggle[0]?.focus()
  }

  tagFilter.replaceChildren(...tagFilterBar())
  tagFilter.hidden = state.tag === null
  renderFoundationsEntry(foundationsNav)
  tree.replaceChildren(...renderSidebar(renderTree))

  if (reveal) {
    tree.querySelector('.test.active')?.scrollIntoView({ block: 'nearest' })
  }
}
