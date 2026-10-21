import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { step } from '@describe-me/vitest'
import { Disclosure } from './Disclosure'

// describe-me records a frame after the render and after every user-event
// action. `step()` names a frame and groups the actions inside it.
describe('Disclosure', () => {
  it('opens and closes', async () => {
    const user = userEvent.setup()
    const screen = render(<Disclosure label="Show details">Shipped on Monday.</Disclosure>)

    await user.click(screen.getByRole('button', { name: 'Show details' }))

    expect(screen.getByText('Shipped on Monday.')).toBeDefined()

    await step('close it again', async () => {
      await user.click(screen.getByRole('button', { name: 'Show details' }))
    })

    expect(screen.queryByText('Shipped on Monday.')).toBeNull()
  })
})
