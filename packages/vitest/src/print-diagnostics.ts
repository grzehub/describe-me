import { manifestDiagnostics } from '@describe-me/core/diagnostics'
import type { Manifest } from '@describe-me/core/types'

/** How many names or paths a warning line spells out before summing up the rest. */
const SHOWN = 5

function listed(items: string[]): string {
  const shown = items.slice(0, SHOWN).join(', ')
  const rest = items.length - SHOWN

  if (rest > 0) {
    return `${shown} (+${rest} more)`
  }

  return shown
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * Warn, one line per kind, about what the manifest could not document. Prints
 * nothing when everything is named, documented and loadable. The viewer shows
 * the same list in its header.
 */
export function printDiagnostics(manifest: Manifest): void {
  const { anonymous, undocumented, assetsMissing } = manifestDiagnostics(manifest)

  if (anonymous.length > 0) {
    console.warn(
      `describe-me: ${plural(anonymous.length, 'test renders', 'tests render')} an anonymous component; export it from a project module or give it a displayName`,
    )
  }

  if (undocumented.length > 0) {
    console.warn(
      `describe-me: ${plural(undocumented.length, 'component has', 'components have')} no props docs: ${listed(undocumented.map((component) => component.name))}`,
    )
  }

  if (assetsMissing.length > 0) {
    console.warn(
      `describe-me: ${plural(assetsMissing.length, 'asset was', 'assets were')} not found in the project and will not load in the viewer: ${listed(assetsMissing)}`,
    )
  }
}
