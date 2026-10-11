import { aroundAll, aroundEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { loggedSteps, logStep } from './order-log'
import { OrderLog } from './OrderLog'

aroundAll(async (runSuite) => {
  logStep('file aroundAll')
  await runSuite()
  logStep('file aroundAll teardown')
})

aroundEach(async (runTest) => {
  logStep('file aroundEach')
  await runTest()
  logStep('file aroundEach teardown')
})

describe('Around hooks', () => {
  aroundAll(async (runSuite) => {
    logStep('suite aroundAll')
    await runSuite()
    logStep('suite aroundAll teardown')
  })

  beforeAll(() => {
    logStep('suite beforeAll')
  })

  aroundEach(async (runTest) => {
    logStep('suite aroundEach')
    await runTest()
    logStep('suite aroundEach teardown')
  })

  beforeEach(() => {
    logStep('suite beforeEach')
  })

  it('wrap the rest of the arrange phase', async () => {
    logStep('body')

    const steps = loggedSteps()
    const expected = [
      'file aroundAll',
      'setup beforeAll',
      'suite aroundAll',
      'suite beforeAll',
      'file aroundEach',
      'suite aroundEach',
      'setup beforeEach',
      'suite beforeEach',
      'body',
    ]

    await render(<OrderLog steps={steps} expected={expected} />)
    expect(steps).toEqual(expected)
  })
})
