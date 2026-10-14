/**
 * The `stories` option and its two tags. Kept apart from `runtime-options.ts`,
 * because the public types import this file and must not carry that file's
 * augmentation of Vitest's `ProvidedContext`. The test runtime imports it, so
 * no Node imports.
 */

/** Which tests of the recorded files become stories: every one, or only those tagged `docs`. */
export type StoriesMode = 'all' | 'tagged'

/** The Vitest tag that picks a test, a suite or a file for the docs when `stories` is `'tagged'`. */
export const DOCS_TAG = 'docs' as const

/** The Vitest tag that keeps a test, a suite or a file out of the docs, whatever `stories` says. */
export const NO_DOCS_TAG = 'no-docs' as const
