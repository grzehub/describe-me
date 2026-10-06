import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsernameField } from './UsernameField'

describe('UsernameField', () => {
  // The update lands in the bare sleep, with the act flag on, so it warns.
  it('shows the availability after a bare sleep', async () => {
    const user = userEvent.setup()
    const screen = render(<UsernameField />)

    await user.type(screen.getByLabelText('Username'), 'a')
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(screen.getByText('Available')).toBeDefined()
  })

  // The update lands in `findByText`, which waits with the act flag off, so it does not warn.
  it('shows the availability with findBy', async () => {
    const user = userEvent.setup()
    const screen = render(<UsernameField />)

    await user.type(screen.getByLabelText('Username'), 'a')

    await screen.findByText('Available')
  })
})
