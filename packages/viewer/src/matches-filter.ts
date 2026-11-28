import type { ManifestModule, ManifestTest } from '@describe-me/core/types'
import { changeMarks } from './change-marks.js'
import { matchesQuery } from './matches-query.js'
import { state } from './state.js'

/**
 * Whether the sidebar shows the test of `mod`: it matches the search, carries
 * the tag filtered by and, under the Changed filter, changed or was added
 * against the base.
 */
export function matchesFilter(test: ManifestTest, mod: ManifestModule): boolean {
  if (state.tag !== null && !(test.tags ?? []).includes(state.tag)) {
    return false
  }

  if (state.changed && !changeMarks(state.changes).has(test.id)) {
    return false
  }

  return matchesQuery(test, mod, state.query)
}
