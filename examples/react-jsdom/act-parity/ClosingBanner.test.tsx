import { describe, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { ClosingBanner } from './ClosingBanner'

describe('ClosingBanner', () => {
  // `fireEvent`, because a user-event call would drain the tick itself.
  it('ends right after the click', () => {
    const screen = render(<ClosingBanner />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  })
})
