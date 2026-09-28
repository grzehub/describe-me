import { createContext, type ReactElement } from 'react'
import { describe, it } from 'vitest'
import { render } from '@testing-library/react'
// Internal to @describe-me/react, not in its package exports.
import { describeRendered } from '../../../packages/react/dist/describe-rendered.js'
import { Badge } from '../src/Badge'

const CALLS = 50
const Density = createContext('comfortable')

const stats = (xs: number[]) => {
  const sorted = [...xs].sort((left, right) => left - right)
  const quantile = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]

  return { median: +quantile(0.5).toFixed(2), p95: +quantile(0.95).toFixed(2) }
}

function Rows({ count }: { count: number }) {
  return (
    <ul>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <span>{`Item ${i}`}</span>
          <button type="button">edit</button>
        </li>
      ))}
    </ul>
  )
}

// The Badge sits in the rendered tree only, so the element search cannot find it.
function RowsThenBadge() {
  return (
    <>
      <Rows count={1000} />
      <Badge>after the rows</Badge>
    </>
  )
}

function RowsThenSpan() {
  return (
    <>
      <Rows count={1000} />
      <span>after the rows</span>
    </>
  )
}

function measure(naming: string, ui: ReactElement): void {
  const { container } = render(ui)
  const nodes = document.querySelectorAll('*').length
  const times: number[] = []

  for (let i = 0; i < CALLS; i++) {
    const startedAt = performance.now()
    describeRendered(ui, container, false)
    times.push(performance.now() - startedAt)
  }

  console.log('BENCH ' + JSON.stringify({ naming, nodes, ...stats(times) }))
}

describe('naming cost', () => {
  it('registered root', () => {
    measure('registered root', <Badge>registered</Badge>)
  })

  it('provider root, registered after the rows', () => {
    measure(
      'provider root, registered after the rows',
      <Density.Provider value="compact">
        <RowsThenBadge />
      </Density.Provider>,
    )
  })

  it('provider root, nothing registered', () => {
    measure(
      'provider root, nothing registered',
      <Density.Provider value="compact">
        <RowsThenSpan />
      </Density.Provider>,
    )
  })
})
