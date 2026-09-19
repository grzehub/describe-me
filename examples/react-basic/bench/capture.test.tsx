import { describe, it } from 'vitest'
import { render, step } from '@describe-me/react'
import { snapshot, createMirror } from 'rrweb-snapshot'

function List({ n }: { n: number }) {
  return (
    <ul style={{ fontFamily: 'sans-serif' }}>
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className={`row row-${i % 5}`} data-index={i}>
          <span className="cell">Item {i}</span>
          <button type="button" className="btn btn-ghost btn-sm" aria-label={`edit ${i}`}>
            edit
          </button>
        </li>
      ))}
    </ul>
  )
}

const ROUNDS = 20
const stats = (xs: number[]) => {
  const sorted = [...xs].sort((left, right) => left - right)
  const quantile = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]

  return { median: +quantile(0.5).toFixed(2), p95: +quantile(0.95).toFixed(2) }
}

const time = async (fn: () => Promise<unknown> | unknown) => {
  const t0 = performance.now()
  await fn()
  return performance.now() - t0
}

describe('capture cost', () => {
  for (const rows of [10, 100, 1000, 5000]) {
    it(`${rows} rows`, async () => {
      await render(<List n={rows} />)
      const nodes = document.querySelectorAll('*').length

      const stepT: number[] = []
      const settleT: number[] = []
      const snapT: number[] = []
      const hashT: number[] = []
      for (let i = 0; i < ROUNDS; i++) {
        stepT.push(await time(() => step(`round ${i}`, () => {})))
        settleT.push(
          await time(async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 0))
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          }),
        )

        let node: unknown
        snapT.push(
          await time(() => {
            node = snapshot(document, { mirror: createMirror(), inlineStylesheet: true })
          }),
        )

        hashT.push(
          await time(() =>
            JSON.stringify(node, (key, value) =>
              key === 'id' || key === 'rootId' ? undefined : value,
            ),
          ),
        )
      }

      console.log(
        'BENCH ' +
          JSON.stringify({
            rows,
            nodes,
            step: stats(stepT),
            settle: stats(settleT),
            snapshot: stats(snapT),
            hash: stats(hashT),
          }),
      )
    })
  }
})
