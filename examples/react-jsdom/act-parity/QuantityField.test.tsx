import { describe, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantityField } from './QuantityField'

describe('QuantityField', () => {
  it('shows the validation error after typing', async () => {
    const user = userEvent.setup()
    const screen = render(<QuantityField />)

    // One key, so one validation is in flight and its result changes the state.
    await user.type(screen.getByLabelText('Quantity'), '0')

    await screen.findByText('Enter 1 or more')
  })
})
