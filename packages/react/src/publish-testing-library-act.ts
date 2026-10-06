import { getConfig } from '@testing-library/react'

// `testing-library-wraps-in-act.ts` in @describe-me/vitest reads this key.
const ACT_CHECK = Symbol.for('describe-me.testing-library-act')

type ActCheckHost = typeof globalThis & { [ACT_CHECK]?: () => boolean }

/**
 * Leave a check on `globalThis` that holds while @testing-library/dom keeps the
 * `asyncWrapper` @testing-library/react installed, so a user-event call drains
 * a macrotask before it resolves. A global, because @describe-me/vitest reads it
 * and does not depend on this package.
 */
export function publishTestingLibraryAct(): void {
  const installed = getConfig().asyncWrapper
  const host = globalThis as ActCheckHost

  host[ACT_CHECK] = () => getConfig().asyncWrapper === installed
}
