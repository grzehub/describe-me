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
  const s = [...xs].sort((a, b) => a - b)
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return { median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2) }
}
const time = async (fn: () => Promise<unknown> | unknown) => {
  const t0 = performance.now()
  await fn()
  return performance.now() - t0
}

describe('capture cost', () => {
  for (const n of [10, 100, 1000, 5000]) {
    it(`${n} rows`, async () => {
      await render(<List n={n} />)
      const nodes = document.querySelectorAll('*').length

      const stepT: number[] = []
      const settleT: number[] = []
      const snapT: number[] = []
      const hashT: number[] = []
      for (let i = 0; i < ROUNDS; i++) {
        stepT.push(await time(() => step(`round ${i}`, () => {})))
        settleT.push(
          await time(async () => {
            await new Promise<void>((r) => setTimeout(r, 0))
            await new Promise<void>((r) => requestAnimationFrame(() => r()))
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
            JSON.stringify(node, (k, v) => (k === 'id' || k === 'rootId' ? undefined : v)),
          ),
        )
      }
      console.log(
        'BENCH ' +
          JSON.stringify({
            rows: n,
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
