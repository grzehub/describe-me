import type { ManifestTest } from '@describe-me/core/types'
import { shownTags } from './shown-tags.js'

/** Whether every word of the sidebar's search occurs in the test's full name, file, component or tags. */
export function matchesQuery(test: ManifestTest, moduleId: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const fields = [test.fullName, moduleId, test.component?.name ?? '', ...shownTags(test)].map(
    (field) => field.toLowerCase(),
  )

  return terms.every((term) => fields.some((field) => field.includes(term)))
}
