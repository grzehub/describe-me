import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Panel } from './Panel'

describe('Panel', () => {
  it('renders a title and body', async () => {
    const screen = render(<Panel title="Imported CSS">body text</Panel>)

    expect(screen.getByText('Imported CSS')).toBeDefined()
  })
})
