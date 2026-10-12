/**
 * The `stories` option and its two tags. Kept apart from `runtime-options.ts`,
 * because the public types import this file and must not carry that file's
 * augmentation of Vitest's `ProvidedContext`. The test runtime imports it, so
 * no Node imports. The tags live in core, which the viewer reads too.
 */

export { DOCS_TAG, NO_DOCS_TAG } from '@describe-me/core/types'

/** Which tests of the recorded files become stories: every one, or only those tagged `docs`. */
export type StoriesMode = 'all' | 'tagged'
