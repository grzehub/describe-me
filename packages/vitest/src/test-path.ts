import type { TestCase } from 'vitest/node'

/** Suite names of a test case, from outermost to innermost. */
export function testPath(tc: TestCase): string[] {
  const path: string[] = []
  let parent: TestCase['parent'] | undefined = tc.parent
  while (parent && parent.type === 'suite') {
    path.unshift(parent.name)
    parent = parent.parent
  }

  return path
}
