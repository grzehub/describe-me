import type { Manifest } from '@describe-me/core/types'

/**
 * The manifest without tests that recorded nothing but their closing frame,
 * and without the modules they leave empty. The reporter no longer writes
 * such tests, but data written by 0.4 still holds them.
 */
export function withoutEmptyTests(manifest: Manifest): Manifest {
  const modules = manifest.modules
    .map((mod) => ({
      ...mod,
      tests: mod.tests.filter((test) => test.frames.some((frame) => frame.kind !== 'end')),
    }))
    .filter((mod) => mod.tests.length > 0)

  return { ...manifest, modules }
}
