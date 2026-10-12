import { expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from '../src/Badge'

it('lives in a file without tags', () => {
  const screen = render(<Badge>plain</Badge>)

  expect(screen.getByText('plain')).toBeDefined()
})
