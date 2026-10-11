import { test as base } from 'vitest'
import { render } from '@testing-library/react'
import { loggedSteps, logStep } from './order-log'
import { OrderLog } from './OrderLog'

interface Fixtures {
  account: { name: string }
  user: { name: string; account: string }
  unused: string
  audit: void
}

const test = base
  .extend<Fixtures>({
    account: async ({}, use) => {
      logStep('account')
      await use({ name: 'Acme' })
      logStep('account teardown')
    },
    user: async ({ account }, use) => {
      logStep('user')
      await use({ name: 'Ada', account: account.name })
      logStep('user teardown')
    },
    unused: async () => {
      throw new Error('the unused fixture must not be computed')
    },
    audit: [
      async ({}, use) => {
        logStep('audit')
        await use()
        logStep('audit teardown')
      },
      { auto: true },
    ],
  })
  .extend('greeting', ({ user }, { onCleanup }) => {
    logStep('greeting')
    onCleanup(() => logStep('greeting cleanup'))

    return `Hello, ${user.name} of ${user.account}`
  })

test.beforeEach(({ account }) => {
  logStep(`beforeEach with ${account.name}`)
})

describe('Fixtures', () => {
  test('computes the fixtures the test uses', ({ greeting }) => {
    logStep('body')

    const steps = loggedSteps()
    const expected = [
      'setup beforeAll',
      'audit',
      'setup beforeEach',
      'account',
      'beforeEach with Acme',
      'user',
      'greeting',
      'body',
    ]

    render(
      <>
        <p>{greeting}</p>
        <OrderLog steps={steps} expected={expected} />
      </>,
    )

    expect(steps).toEqual(expected)
  })
})
