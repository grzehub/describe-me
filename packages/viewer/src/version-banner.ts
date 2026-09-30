import type { Manifest } from '@describe-me/core/types'
import { version } from '../package.json'

const MINOR_LINE = /^(\d+)\.(\d+)\./

/** `0.5` for `0.5.1` and `0.5.1-next.0`, null for anything that does not parse. */
function minorLine(candidate: string): string | null {
  const match = MINOR_LINE.exec(candidate)

  if (!match) {
    return null
  }

  return `${match[1]}.${match[2]}`
}

/**
 * The warning to show when the data comes from another describe-me release
 * line than this viewer, or null when there is nothing to warn about.
 */
export function versionBanner(manifest: Manifest | null): string | null {
  // Every writer without a generator is 0.5.0 or older, and this viewer reads them all.
  if (!manifest?.generator) {
    return null
  }

  const { generator } = manifest
  const ours = minorLine(version)

  if (ours !== null && ours === minorLine(generator.version)) {
    return null
  }

  return `Written by ${generator.name} ${generator.version}. This viewer is describe-me ${version}, so frames may not show correctly. Install every describe-me package at the same version.`
}
