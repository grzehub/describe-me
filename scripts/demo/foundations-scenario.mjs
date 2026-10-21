import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../docs/repo-root.mjs'
import { fragmentBetween } from './fragment-between.mjs'
import { linesBetween } from './lines-between.mjs'

const CSS_FILE = 'examples/shadcn/src/index.css'
const SECTIONS = ['Typography', 'Spacing', 'Radius']

/** Record the Foundations view of the shadcn example on `stage`, whose viewer shows a test. */
export async function foundationsScenario(stage) {
  const text = fragmentBetween(readFileSync(join(repoRoot, CSS_FILE), 'utf8'), ':root {', '}')

  await stage.setCode({ file: 'index.css', language: 'css', text })
  await stage.focus('code')
  await stage.hot(linesBetween(text, ':root {', '  --primary: oklch(0.52 0.23 285);'))
  await stage.caption(
    'Your design system is CSS: tokens in <em>:root</em>, a brand ramp in <em>@theme</em>.',
    2600,
  )

  await stage.focus('viewer')
  await stage.click(stage.viewer.locator('.foundations-entry'), { settleMs: 0 })
  await stage.viewer.locator('.foundations').waitFor({ state: 'visible', timeout: 20_000 })
  await stage.hot([])
  await stage.caption(
    '<em>Foundations</em> reads the tokens from the CSS your tests load. No MDX, no second source of truth.',
    3000,
  )

  for (const section of SECTIONS) {
    await stage.click(stage.viewer.locator('.foundations-sections button', { hasText: section }), {
      settleMs: 1700,
    })
  }

  await stage.click(stage.viewer.locator('.foundations-sections button', { hasText: 'Colors' }), {
    settleMs: 600,
  })

  await stage.click(stage.viewer.locator('.foundations-filter'), { settleMs: 200 })
  await stage.focus('both')
  await stage.hot(linesBetween(text, '--primary:'))
  await stage.caption('Filter by name. Pairs show their WCAG contrast.', 0)
  await stage.type('primary')
  await stage.pause(3000)

  await stage.end(3000)
}
