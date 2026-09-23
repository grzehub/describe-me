import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { step } from '@describe-me/vitest'
import { Counter } from './Counter'

describe('Counter', () => {
  it('increments', async () => {
    const screen = await render(<Counter />)
    await screen.getByRole('button', { name: 'increment' }).click()
    await screen.getByRole('button', { name: 'increment' }).click()
    await expect.element(screen.getByLabelText('value')).toHaveTextContent('2')
  })

  it('does not go below the minimum', async () => {
    const screen = await render(<Counter initial={1} />)
    await step('go down to the minimum', async () => {
      await screen.getByRole('button', { name: 'decrement' }).click()
    })

    await expect.element(screen.getByLabelText('value')).toHaveTextContent('0')
    await expect.element(screen.getByRole('button', { name: 'decrement' })).toBeDisabled()
    await expect.element(screen.getByText('minimum reached')).toBeVisible()
  })

  it('resets to the initial value', async () => {
    const screen = await render(<Counter initial={5} />)
    await screen.getByRole('button', { name: 'increment' }).click()
    await screen.getByRole('button', { name: 'reset' }).click()
    await expect.element(screen.getByLabelText('value')).toHaveTextContent('5')
  })
})
