import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ReadyBadge } from './ReadyBadge'

describe('ReadyBadge', () => {
  // In the lazy runs, `flush()` waits before it takes this render frame.
  it('ends right after the render', () => {
    const screen = render(<ReadyBadge />)

    expect(screen.getByText('Starting')).toBeDefined()
  })
})
