import { expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from '../src/Badge'

// describe-me switches Testing Library's auto-cleanup off and unmounts in its
// own setup file, so a project without that file leaves this badge mounted.
it('mounts a badge', () => {
  render(<Badge>same</Badge>)
})

it('starts on a clean page', () => {
  const screen = render(<Badge>same</Badge>)

  expect(screen.getAllByText('same')).toHaveLength(1)
})
