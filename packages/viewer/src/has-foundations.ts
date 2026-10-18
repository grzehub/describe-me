import type { ManifestFoundations } from '@describe-me/core/types'

/**
 * Whether the run has a Foundations page: the summary counts tokens or names
 * Material UI. A Material UI page without tokens shows only the setup hint.
 */
export function hasFoundations(summary: ManifestFoundations | undefined): boolean {
  if (summary === undefined) {
    return false
  }

  return summary.tokens > 0 || summary.systems.includes('mui')
}
