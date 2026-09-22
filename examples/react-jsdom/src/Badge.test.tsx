import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders the info tone', async () => {
    const screen = render(<Badge>queued</Badge>)

    expect(screen.getByText('queued')).toBeDefined()
  })

  it('renders the danger tone', async () => {
    const screen = render(<Badge tone="danger">failed</Badge>)

    expect(screen.getByText('failed')).toBeDefined()
  })
})
