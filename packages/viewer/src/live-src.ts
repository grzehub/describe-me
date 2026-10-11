import type { Manifest, ManifestTest } from '@describe-me/core/types'

function namesOf(test: ManifestTest): string {
  return JSON.stringify([...test.path, test.name])
}

/**
 * The URL of the live page that mounts `test`, or `null` when no module of
 * the manifest holds it. `occurrence` tells tests of one module with the same
 * path and name apart, counted the way the live page counts them.
 */
export function liveSrc(base: string, manifest: Manifest, test: ManifestTest): string | null {
  const owner = manifest.modules.find((candidate) => candidate.tests.includes(test))

  if (!owner) {
    return null
  }

  const names = namesOf(test)
  const earlier = owner.tests.slice(0, owner.tests.indexOf(test))
  const occurrence = 1 + earlier.filter((candidate) => namesOf(candidate) === names).length
  const url = new URL('live.html', base)

  url.search = new URLSearchParams({
    file: owner.id,
    path: names,
    occurrence: String(occurrence),
    origin: location.origin,
  }).toString()

  return url.href
}
