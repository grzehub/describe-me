import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AsyncGreeting } from './AsyncGreeting'

// With the default `renderFrame: 'eager'`, the render frame shows the loader
// and the closing frame shows the greeting.
describe('AsyncGreeting', () => {
  it('greets once loaded', async () => {
    const screen = render(<AsyncGreeting name="Ada" />)

    expect(screen.getByText('Loading…')).toBeDefined()

    await screen.findByText('Hello, Ada')
  })
})
