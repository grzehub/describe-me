import { describe, expect, it } from 'vitest'
import { render } from './test-utils'
import { Button } from './PolymorphicButton'

describe('PolymorphicButton', () => {
  it('renders a primary button by default', () => {
    const screen = render(<Button>Continue</Button>)

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined()
  })

  it('renders as a link', () => {
    const screen = render(
      <Button component="a" href="#details" variant="secondary" size="small">
        Details
      </Button>,
    )

    expect(screen.getByRole('link', { name: 'Details' })).toBeDefined()
  })
})
