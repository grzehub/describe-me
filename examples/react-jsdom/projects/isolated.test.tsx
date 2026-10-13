import { expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from '../src/Badge'

// The project of this file has `extends: false`, so describe-me neither records
// nor unmounts here. Testing Library's own cleanup must stay on, or this badge
// is still mounted in the next test.
it('mounts a badge', () => {
  render(<Badge>alone</Badge>)
})

it('starts on a clean page', () => {
  const screen = render(<Badge>alone</Badge>)

  expect(screen.getAllByText('alone')).toHaveLength(1)
})
