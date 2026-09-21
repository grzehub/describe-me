/**
 * Guards the generated manifest against silent regressions: every test must
 * have a `render` frame with a component, and the props docs must be present.
 * Usage: `node scripts/check-manifest.mjs examples/react-basic/.describe-me/manifest.json`
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2]

if (!path) {
  console.error('usage: check-manifest <path/to/manifest.json>')
  process.exit(2)
}

const manifest = JSON.parse(readFileSync(path, 'utf8'))
const tests = manifest.modules.flatMap((module) => module.tests)
const problems = []

for (const test of tests) {
  if (!test.frames.some((frame) => frame.kind === 'render')) {
    problems.push(`${test.fullName}: no render frame`)
  }

  if (!test.component) {
    problems.push(`${test.fullName}: no component recorded`)
  }
}

const documented = Object.keys(manifest.components ?? {})

if (documented.length === 0) {
  problems.push('manifest.components is empty')
}

if (problems.length > 0) {
  console.error(`check-manifest: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

console.log(
  `check-manifest: ok — ${tests.length} tests, ${tests.flatMap((test) => test.frames).length} frames, ${documented.length} components documented`,
)
