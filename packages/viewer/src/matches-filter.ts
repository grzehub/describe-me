import type { ManifestModule, ManifestTest } from '@describe-me/core/types'
import { matchesQuery } from './matches-query.js'
import { state } from './state.js'

/**
 * Whether the sidebar shows the test of `mod`: it matches the search and
 * carries the tag filtered by.
 */
export function matchesFilter(test: ManifestTest, mod: ManifestModule): boolean {
  if (state.tag !== null && !(test.tags ?? []).includes(state.tag)) {
    return false
  }

  return matchesQuery(test, mod, state.query)
}
