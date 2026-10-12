import type { ViteUserConfig } from 'vitest/config'
import { DOCS_TAG, NO_DOCS_TAG } from './stories-mode.js'

type TagDefinition = NonNullable<NonNullable<ViteUserConfig['test']>['tags']>[number]

const DEFINITIONS: TagDefinition[] = [
  { name: DOCS_TAG, description: "describe-me: a story, when stories is 'tagged'" },
  { name: NO_DOCS_TAG, description: 'describe-me: never a story' },
]

/**
 * The definitions of `docs` and `no-docs` that the user's config lacks.
 * Vitest throws on a tag it has no definition for, and Vite concatenates this
 * list with the user's, so a tag the user defines is left to them.
 */
export function docsTagDefinitions(userConfig: ViteUserConfig): TagDefinition[] {
  const defined = new Set((userConfig.test?.tags ?? []).map((tag) => tag.name))

  return DEFINITIONS.filter((tag) => !defined.has(tag.name))
}
