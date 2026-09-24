import { describe, expect, it } from 'vitest'
import { render } from './test-utils'
import { Text } from './Text'

describe('Text', () => {
  it('renders body copy', () => {
    const screen = render(<Text>The quick brown fox</Text>)

    expect(screen.getByText('The quick brown fox')).toBeDefined()
  })

  it('renders small muted copy', () => {
    const screen = render(
      <Text size="small" muted>
        Last edited today
      </Text>,
    )

    expect(screen.getByText('Last edited today')).toBeDefined()
  })
})
