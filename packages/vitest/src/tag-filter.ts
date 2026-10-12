import { DOCS_TAG, NO_DOCS_TAG, type StoriesMode } from './stories-mode.js'

/**
 * Decides from a test's tags, its own and those it inherits from its suites
 * and its file, whether it becomes a story. `no-docs` wins over `docs`. The
 * test runtime imports this file, so no Node imports.
 */
export function tagFilter(stories: StoriesMode): (tags: readonly string[]) => boolean {
  return (tags) => {
    if (tags.includes(NO_DOCS_TAG)) {
      return false
    }

    return stories === 'all' || tags.includes(DOCS_TAG)
  }
}
