import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ReadyBadge } from './ReadyBadge'

describe('ReadyBadge', () => {
  // Render frames are lazy here, so `flush()` waits before it takes this one.
  it('ends right after the render', () => {
    const screen = render(<ReadyBadge />)

    expect(screen.getByText('Starting')).toBeDefined()
  })
})
