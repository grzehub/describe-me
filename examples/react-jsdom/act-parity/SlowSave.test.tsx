import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { SlowSave } from './SlowSave'

// The baseline: this test warns with recording on and off. A bare sleep
// instead of `findBy…` leaves the update outside act(), and the wide gap keeps
// it out of every 0 ms wait.
describe('SlowSave', () => {
  it('shows that it saved after a bare sleep', async () => {
    const screen = render(<SlowSave />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(screen.getByText('Saved')).toBeDefined()
  })
})
