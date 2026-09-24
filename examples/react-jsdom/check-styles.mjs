/**
 * Reads `.describe-me/`, then for each styling technique reports whether its
 * selector and its declared colour are present anywhere in the serialized DOM.
 * Exits non-zero when anything but adoptedStyleSheets (unsupported by jsdom) is lost.
 * Usage: `node check-styles.mjs`
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DATA = '.describe-me'

const TECHNIQUES = [
  { name: 'inline style attribute', selector: 'styled-inline', value: 'rgb(255, 0, 0)' },
  { name: 'runtime <style> tag', selector: '.styled-tag', value: 'rgb(0, 128, 0)' },
  { name: 'CSSOM insertRule', selector: '.styled-cssom', value: 'rgb(0, 0, 255)' },
  { name: 'adoptedStyleSheets', selector: '.styled-adopted', value: 'rgb(255, 165, 0)' },
  { name: 'styled-components (info)', selector: 'border-radius: 999px', value: 'rgb(43, 92, 255)' },
  {
    name: 'styled-components (danger)',
    selector: 'border-radius: 999px',
    value: 'rgb(221, 51, 51)',
  },
  { name: 'imported .css file', selector: '.panel-title', value: '--accent: #2b5cff' },
  {
    name: 'styled-components + theme',
    selector: 'letter-spacing: -0.01em',
    value: 'rgb(17, 17, 17)',
  },
  {
    name: 'styled-components createGlobalStyle',
    selector: 'box-sizing: border-box',
    value: '--global-styles: applied',
  },
]

const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8'))
const tests = manifest.modules.flatMap((module) => module.tests)
const frames = tests.flatMap((test) => test.frames)
const haystack = frames.map((frame) => readFileSync(join(DATA, frame.snapshot), 'utf8')).join('\n')

console.log(
  `snapshot corpus: ${tests.length} tests, ${frames.length} frames, ` +
    `${(haystack.length / 1024).toFixed(0)} kB of serialized DOM\n`,
)

const rows = TECHNIQUES.map((technique) => ({
  technique: technique.name,
  selector: haystack.includes(technique.selector),
  value: haystack.includes(technique.value),
}))

const width = Math.max(...rows.map((row) => row.technique.length))

for (const row of rows) {
  const mark = (present) => (present ? 'yes' : 'NO ')
  const verdict = row.selector && row.value ? '' : '   <-- lost'

  console.log(
    `${row.technique.padEnd(width)}  selector ${mark(row.selector)}  colour ${mark(row.value)}${verdict}`,
  )
}

const lost = rows.filter((row) => !row.selector || !row.value)

console.log(`\n${rows.length - lost.length}/${rows.length} techniques survived the snapshot`)

// jsdom does not implement constructable stylesheets, so that one loss is expected.
const unexpected = lost.filter((row) => row.technique !== 'adoptedStyleSheets')

if (unexpected.length > 0) {
  console.error(`check-styles: lost ${unexpected.map((row) => row.technique).join(', ')}`)
  process.exit(1)
}
