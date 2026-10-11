import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { loggedSteps, logStep } from './order-log'
import { OrderLog } from './OrderLog'

beforeAll(() => {
  logStep('file beforeAll')
})

beforeEach(() => {
  logStep('file beforeEach')
})

describe('Setup files', () => {
  beforeAll(() => {
    logStep('suite beforeAll')
  })

  beforeEach(() => {
    logStep('suite beforeEach')
  })

  it('run their hooks before the hooks of the test file', async () => {
    logStep('body')

    const steps = loggedSteps()
    const expected = [
      'setup beforeAll',
      'file beforeAll',
      'suite beforeAll',
      'setup beforeEach',
      'file beforeEach',
      'suite beforeEach',
      'body',
    ]

    await render(<OrderLog steps={steps} expected={expected} />)
    expect(steps).toListSteps(expected)
    expect(document.body.dataset.liveFixture).toBe('prepared')
  })
})
