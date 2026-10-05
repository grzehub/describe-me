import { describe, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileLoader } from './ProfileLoader'

describe('ProfileLoader', () => {
  it('shows the name once the promise resolves', async () => {
    const user = userEvent.setup()
    const screen = render(<ProfileLoader />)

    await user.click(screen.getByRole('button', { name: 'Load profile' }))

    await screen.findByText('Ada Lovelace')
  })
})
