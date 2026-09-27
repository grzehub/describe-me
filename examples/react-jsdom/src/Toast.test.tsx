import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { step } from '@describe-me/vitest'
import { Toast } from './Toast'

// Like many real suites, this file leaves fake timers on and cleans up after
// itself. Neither may hang a capture or leave an empty closing frame.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(cleanup)

describe('Toast', () => {
  it('dismisses from its button', async () => {
    const screen = render(<Toast message="Saved" />)

    await step('dismiss it', () => {
      fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    })

    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('hides itself after its duration', () => {
    const screen = render(<Toast message="Saved" />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText('Saved')).toBeNull()
  })
})
