import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { step } from '@describe-me/vitest'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  it('opens and closes through the setup instance', async () => {
    const user = userEvent.setup()
    const screen = render(<Disclosure label="show details">the details</Disclosure>)

    await user.click(screen.getByRole('button', { name: 'show details' }))

    expect(screen.getByText('the details')).toBeDefined()

    await step('close it again', async () => {
      await user.click(screen.getByRole('button', { name: 'show details' }))
    })

    expect(screen.queryByText('the details')).toBeNull()
  })

  it('opens through the direct API', async () => {
    const screen = render(<Disclosure label="show details">the details</Disclosure>)

    // Delegates to a setup instance internally; the depth guard must keep this
    // to one frame rather than two.
    await userEvent.click(screen.getByRole('button', { name: 'show details' }))

    expect(screen.getByText('the details')).toBeDefined()
  })

  it('keeps frames in order across a rerender', async () => {
    const user = userEvent.setup()
    const screen = render(<Disclosure label="first label">the details</Disclosure>)

    screen.rerender(<Disclosure label="second label">the details</Disclosure>)

    await user.click(screen.getByRole('button', { name: 'second label' }))

    expect(screen.getByText('the details')).toBeDefined()
  })
})
