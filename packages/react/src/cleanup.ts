import { cleanup as unmountAll } from '@testing-library/react'
import { recorder } from '@describe-me/core'

/**
 * Drop-in for `cleanup` from @testing-library/react. Takes the closing frame
 * before it unmounts, so `afterEach(cleanup)` in a test file records the last
 * state instead of an empty page.
 */
export function cleanup(): void {
  recorder.beforeInteraction()
  void recorder.capture('end', 'end of test', undefined, { settle: false })
  unmountAll()
}
