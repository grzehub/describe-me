import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Button } from './Button'

// Every `it` is a story. Props read from TypeScript show in the viewer's
// component overview, with the values these tests cover.
describe('Button', () => {
  it('primary', () => {
    const screen = render(<Button>Save changes</Button>)

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined()
  })

  it('quiet', () => {
    const screen = render(<Button tone="quiet">Cancel</Button>)

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined()
  })

  it('disabled', () => {
    const screen = render(<Button disabled>Saving…</Button>)

    expect(screen.getByRole('button', { name: 'Saving…' })).toHaveProperty('disabled', true)
  })
})
