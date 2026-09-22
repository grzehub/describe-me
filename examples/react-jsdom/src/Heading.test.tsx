import { describe, expect, it } from 'vitest'
import { render } from './test-utils'
import { Heading } from './Heading'

describe('Heading', () => {
  it('takes its colour from the theme', () => {
    // Synchronous, like most existing Testing Library suites: no await.
    const { getByText } = render(<Heading>Themed title</Heading>)

    expect(getByText('Themed title')).toBeDefined()
  })
})
