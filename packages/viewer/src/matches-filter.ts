import type { ManifestTest } from '@describe-me/core/types'
import { matchesQuery } from './matches-query.js'
import { state } from './state.js'

/** Whether the sidebar shows the test: it matches the search and carries the tag filtered by. */
export function matchesFilter(test: ManifestTest, moduleId: string): boolean {
  if (state.tag !== null && !(test.tags ?? []).includes(state.tag)) {
    return false
  }

  return matchesQuery(test, moduleId, state.query)
}
