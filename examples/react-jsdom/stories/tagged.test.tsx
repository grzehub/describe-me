import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { recorder } from '@describe-me/vitest'
import { Badge } from '../src/Badge'

// The setup file must not record what the reporter would drop, so tagged tests
// check the recorder too. Untagged ones record only with `stories: 'all'`.

describe('tagged suite', { tags: ['docs'] }, () => {
  it('inherits docs from its suite', () => {
    expect(recorder.isActive).toBe(true)

    const screen = render(<Badge>queued</Badge>)

    expect(screen.getByText('queued')).toBeDefined()
  })

  it('opts out with no-docs', { tags: ['no-docs'] }, () => {
    expect(recorder.isActive).toBe(false)

    const screen = render(<Badge tone="danger">failed</Badge>)

    expect(screen.getByText('failed')).toBeDefined()
  })
})

it('carries docs itself', { tags: ['docs'] }, () => {
  expect(recorder.isActive).toBe(true)

  const screen = render(<Badge>own tag</Badge>)

  expect(screen.getByText('own tag')).toBeDefined()
})

it('has no tag', () => {
  const screen = render(<Badge>untagged</Badge>)

  expect(screen.getByText('untagged')).toBeDefined()
})

it('opts out at the top level', { tags: ['no-docs'] }, () => {
  expect(recorder.isActive).toBe(false)

  const screen = render(<Badge>left out</Badge>)

  expect(screen.getByText('left out')).toBeDefined()
})
