import type { Manifest } from '@describe-me/core/types'

/** The document's title: the project's name before the tool's, so two viewers tell apart in the tabs. */
export function pageTitle(manifest: Manifest | null): string {
  return manifest?.project ? `${manifest.project} · describe-me` : 'describe-me'
}
