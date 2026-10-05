import { describe, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DelayedTooltip } from './DelayedTooltip'

describe('DelayedTooltip', () => {
  it('opens on hover after a delay', async () => {
    const user = userEvent.setup()
    const screen = render(<DelayedTooltip />)

    await user.hover(screen.getByRole('button', { name: 'Help' }))

    await screen.findByRole('tooltip')
  })
})
