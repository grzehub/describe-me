import type { Manifest } from '@describe-me/core/types'

export function withoutEmptyTests(manifest: Manifest): Manifest {
  const modules = manifest.modules
    .map((mod) => ({
      ...mod,
      tests: mod.tests.filter((test) => test.frames.some((frame) => frame.kind !== 'end')),
    }))
    .filter((mod) => mod.tests.length > 0)

  return { ...manifest, modules }
}
