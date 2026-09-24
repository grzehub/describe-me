import { ANONYMOUS_COMPONENT, type Manifest, type ManifestDiagnostics } from './types.js'

/** Host elements such as `div` are rendered as-is and have no props doc to miss. */
function isHostElement(name: string): boolean {
  return /^[a-z]/.test(name)
}

/**
 * List what the manifest could not document: anonymous components, named ones
 * without props, and assets that will not load. The reporter prints it after a
 * run and the viewer shows it in the header, so both agree on what is missing.
 */
export function manifestDiagnostics(manifest: Manifest): ManifestDiagnostics {
  const anonymous: ManifestDiagnostics['anonymous'] = []
  const undocumented = new Map<string, number>()

  for (const mod of manifest.modules) {
    for (const test of mod.tests) {
      const name = test.component?.name

      if (!name || isHostElement(name)) {
        continue
      }

      if (name === ANONYMOUS_COMPONENT) {
        anonymous.push({ testId: test.id, fullName: test.fullName })
        continue
      }

      if (!manifest.components[name]) {
        undocumented.set(name, (undocumented.get(name) ?? 0) + 1)
      }
    }
  }

  return {
    anonymous,
    undocumented: Array.from(undocumented, ([name, tests]) => ({ name, tests })).sort(
      (left, right) => left.name.localeCompare(right.name),
    ),
    assetsMissing: manifest.assetsMissing ?? [],
  }
}
