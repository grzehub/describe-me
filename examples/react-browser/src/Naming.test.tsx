import { createContext, memo, Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Button } from './Button'
import { Chip } from './Chip'
import { Counter } from './Counter'

const Density = createContext('comfortable')

// Defined here on purpose: the plugin never registers a test file's components.
const Local = memo(function LocalChip() {
  return <Chip label="design" tone="accent" />
})

describe('Naming', () => {
  it('names Button variant=secondary inside a context provider', async () => {
    const screen = await render(
      <Density.Provider value="compact">
        <Button variant="secondary">Keep draft</Button>
      </Density.Provider>,
    )

    await expect.element(screen.getByRole('button')).toHaveClass('btn-secondary')
  })

  it('names Chip tone=accent from a test-local memo', async () => {
    const screen = await render(<Local />)

    await expect.element(screen.getByText('design')).toHaveClass('chip-accent')
  })

  it('names Button size=sm inside a fragment', async () => {
    const screen = await render(
      <>
        <Button size="sm">Compact</Button>
      </>,
    )

    await expect.element(screen.getByRole('button')).toHaveClass('btn-sm')
  })

  it('names Counter initial=2 inside Suspense', async () => {
    const screen = await render(
      <Suspense fallback={null}>
        <Counter initial={2} />
      </Suspense>,
    )

    await expect.element(screen.getByLabelText('value')).toHaveTextContent('2')
  })

  it('names Button variant=ghost after a rerender from an empty fragment', async () => {
    const screen = await render(<></>)
    await screen.rerender(<Button variant="ghost">Skip for now</Button>)

    await expect.element(screen.getByRole('button')).toHaveClass('btn-ghost')
  })
})
