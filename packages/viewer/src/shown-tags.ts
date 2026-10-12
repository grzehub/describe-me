import { DOCS_TAG, NO_DOCS_TAG, type ManifestTest } from '@describe-me/core/types'

const HIDDEN = new Set<string>([DOCS_TAG, NO_DOCS_TAG])

/**
 * The tags the viewer shows for a test. `docs` and `no-docs` only pick which
 * tests record, and with `stories: 'tagged'` every story carries `docs`.
 */
export function shownTags(test: ManifestTest): string[] {
  return (test.tags ?? []).filter((tag) => !HIDDEN.has(tag))
}
