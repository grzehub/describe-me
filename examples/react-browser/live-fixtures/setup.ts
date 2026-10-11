// The setup file of the live fixtures, which run only with LIVE_FIXTURES=1.
// Its hooks prepare what the tests need and undo it, as a real setup file does.
import { afterEach, beforeAll, beforeEach, expect } from 'vitest'
import { logStep } from './order-log'

declare module 'vitest' {
  // The type parameters must match Vitest's declaration, which uses `T` elsewhere.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toListSteps(expected: string[]): R
  }
}

beforeAll(() => {
  logStep('setup beforeAll')
})

beforeEach(() => {
  logStep('setup beforeEach')
  document.body.dataset.liveFixture = 'prepared'
})

afterEach(() => {
  delete document.body.dataset.liveFixture
  logStep('setup afterEach')
})

expect.extend({
  toListSteps(received: string[], expected: string[]) {
    return {
      pass: JSON.stringify(received) === JSON.stringify(expected),
      message: () =>
        `expected the steps ${JSON.stringify(received)} to be ${JSON.stringify(expected)}`,
    }
  },
})
