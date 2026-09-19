import { describe, expect, it } from 'vitest'
import { render, step } from '@describe-me/react'
import { userEvent } from '@describe-me/vitest'
import { Counter } from './Counter'

describe('Counter', () => {
  it('increments', async () => {
    const screen = await render(<Counter />)
    await userEvent.click(screen.getByRole('button', { name: 'increment' }))
    await userEvent.click(screen.getByRole('button', { name: 'increment' }))
    await expect.element(screen.getByLabelText('value')).toHaveTextContent('2')
  })

  it('does not go below the minimum', async () => {
    const screen = await render(<Counter initial={1} />)
    await step('go down to the minimum', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'decrement' }))
    })

    await expect.element(screen.getByLabelText('value')).toHaveTextContent('0')
    await expect.element(screen.getByRole('button', { name: 'decrement' })).toBeDisabled()
    await expect.element(screen.getByText('minimum reached')).toBeVisible()
  })

  it('resets to the initial value', async () => {
    const screen = await render(<Counter initial={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'increment' }))
    await userEvent.click(screen.getByRole('button', { name: 'reset' }))
    await expect.element(screen.getByLabelText('value')).toHaveTextContent('5')
  })
})
