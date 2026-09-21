import type { ManifestTest } from '@describe-me/core/types'

/** Distinct component names recorded by a set of tests, in the order they appear. */
export function componentNamesInScope(tests: ManifestTest[]): string[] {
  const names: string[] = []
  for (const test of tests) {
    const name = test.component?.name
    if (name && !names.includes(name)) {
      names.push(name)
    }
  }

  return names
}
