import { stableTestId } from './stable-test-id.js'

/** One stable id per test of a module, counting repeated names 1-based in the given order. */
export function stableTestIds(
  moduleId: string,
  tests: Iterable<{ path: readonly string[]; name: string }>,
): string[] {
  const seen = new Map<string, number>()
  const ids: string[] = []

  for (const test of tests) {
    const key = [...test.path, test.name].join('\0')
    const occurrence = (seen.get(key) ?? 0) + 1
    seen.set(key, occurrence)
    ids.push(stableTestId(moduleId, test.path, test.name, occurrence))
  }

  return ids
}
