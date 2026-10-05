import { describe, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { step } from '@describe-me/vitest'
import { LikeButton } from './LikeButton'

describe('LikeButton', () => {
  it('shows the like after a step', async () => {
    const screen = render(<LikeButton />)

    // `fireEvent` never waits, so the tick lands in the wait of the step's own capture.
    await step('like it', () => {
      fireEvent.click(screen.getByRole('button', { name: 'Like' }))
    })

    await screen.findByRole('button', { name: 'Liked' })
  })
})
