/**
 * @module-tag docs
 */
import { expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from '../src/Badge'

it('inherits docs from its file', () => {
  const screen = render(<Badge>from the file</Badge>)

  expect(screen.getByText('from the file')).toBeDefined()
})
