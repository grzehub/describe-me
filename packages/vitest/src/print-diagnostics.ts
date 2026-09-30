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
 * Warn about what the manifest could not document, one line per kind. Setup
 * warnings come first, one line each, because they can explain failing tests.
 * Prints nothing when the setup is sound, everything is named, documented and
 * loadable, every font is loaded and no stylesheet comes from a remote host.
 * The viewer shows the same list in its header.
 */
export function printDiagnostics(manifest: Manifest): void {
  const { setupWarnings, anonymous, undocumented, assetsMissing, fontsMissing, remoteStylesheets } =
    manifestDiagnostics(manifest)

  for (const warning of setupWarnings) {
    console.warn(`describe-me: ${warning}`)
  }

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

  if (fontsMissing.length > 0) {
    const families = fontsMissing.map(
      (font) => `${font.family} (${plural(font.tests, 'test', 'tests')})`,
    )

    const pronoun = fontsMissing.length === 1 ? 'it' : 'them'

    console.warn(
      `describe-me: ${plural(fontsMissing.length, 'font family is', 'font families are')} used but never loaded: ${listed(families)} — add ${pronoun} to previewHead`,
    )
  }

  if (remoteStylesheets.length > 0) {
    const hosts = remoteStylesheets.map(
      (stylesheet) => `${stylesheet.host} (${plural(stylesheet.frames, 'frame', 'frames')})`,
    )

    console.warn(
      `describe-me: frames load stylesheets from ${plural(remoteStylesheets.length, 'remote host', 'remote hosts')}, which the viewer fetches from the network: ${listed(hosts)}`,
    )
  }
}
