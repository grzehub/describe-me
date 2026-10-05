import { describe, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CachedSearch } from './CachedSearch'

describe('CachedSearch', () => {
  it('shows the results after a timer chain', async () => {
    const user = userEvent.setup()
    const screen = render(<CachedSearch />)

    await user.click(screen.getByRole('button', { name: 'Search' }))

    await screen.findByText('3 results')
  })
})
