import { createHash } from 'node:crypto'
import type { Manifest, ManifestTest } from '@describe-me/core/types'

/** A test of a manifest under its stable id. */
export interface IndexedTest {
  id: string
  /** `ManifestModule.id` of its module. */
  module: string
  test: ManifestTest
}

// The formula mirrors packages/vitest/src/stable-test-id.ts and stable-test-ids.ts.
// `describe-me` does not depend on `@describe-me/vitest`, so it keeps its own copy.
function stableTestId(moduleId: string, path: string[], name: string, occurrence: number): string {
  let input = [moduleId, ...path, name].join('\0')
  if (occurrence > 1) {
    input += `\0${occurrence}`
  }

  return createHash('sha1').update(input).digest('hex').slice(0, 12)
}

/** As the reporter's `withStableIds`: occurrences count over the module's full list. */
function stableTestIds(moduleId: string, tests: ManifestTest[]): string[] {
  const seen = new Map<string, number>()

  return tests.map((test) => {
    const key = [...test.path, test.name].join('\0')
    const occurrence = (seen.get(key) ?? 0) + 1
    seen.set(key, occurrence)

    return stableTestId(moduleId, test.path, test.name, occurrence)
  })
}

/**
 * The tests of a manifest by id, in manifest order. A test written before 0.5
 * has no `vitestId` and carries Vitest's id, so it gets the stable id the
 * reporter would give it. The first of two tests with one id wins.
 */
export function testIndex(manifest: Manifest): Map<string, IndexedTest> {
  const index = new Map<string, IndexedTest>()

  for (const mod of manifest.modules) {
    const ids = stableTestIds(mod.id.replaceAll('\\', '/'), mod.tests)

    mod.tests.forEach((test, i) => {
      const id = test.vitestId === undefined ? ids[i] : test.id

      if (!index.has(id)) {
        index.set(id, { id, module: mod.id, test })
      }
    })
  }

  return index
}
