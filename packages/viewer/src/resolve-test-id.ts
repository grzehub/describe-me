import type { Manifest } from '@describe-me/core/types'
import { allTests } from './state.js'

/**
 * The id of the test a link asks for, or `null`. A link written before 0.5
 * holds Vitest's id, which lives on as `vitestId`.
 */
export function resolveTestId(manifest: Manifest, requested: string | null): string | null {
  if (requested === null) {
    return null
  }

  const tests = allTests(manifest)
  const exact = tests.find((test) => test.id === requested)
  if (exact) {
    return exact.id
  }

  return tests.find((test) => test.vitestId === requested)?.id ?? null
}
