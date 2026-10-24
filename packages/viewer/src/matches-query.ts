import type { ManifestModule, ManifestTest } from '@describe-me/core/types'
import { shownTags } from './shown-tags.js'

/**
 * Whether every word of the sidebar's search occurs in the test's full name,
 * file, component, tags or the names of its file's groups.
 */
export function matchesQuery(test: ManifestTest, mod: ManifestModule, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const fields = [
    test.fullName,
    mod.id,
    test.component?.name ?? '',
    ...shownTags(test),
    ...(mod.group ?? []),
  ].map((field) => field.toLowerCase())

  return terms.every((term) => fields.some((field) => field.includes(term)))
}
