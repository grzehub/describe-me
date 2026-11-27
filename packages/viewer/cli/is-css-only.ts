import type { TestChange } from './changes-report.js'

/** A test whose frames changed only in their stylesheet text and whose state did not change. */
export function isCssOnly(test: TestChange): boolean {
  return test.change === 'changed' && test.kind === 'css' && test.state === undefined
}
