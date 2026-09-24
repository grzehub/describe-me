/**
 * Guards the generated manifests against silent regressions: every test must
 * have a `render` frame with a named component, every component must have its
 * props docs, and every asset must have been found. Run after `pnpm build`.
 * Usage: `node scripts/check-manifest.mjs <path/to/manifest.json> [...more]`
 */
import { readFileSync } from 'node:fs'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'

const paths = process.argv.slice(2)

if (paths.length === 0) {
  console.error('usage: check-manifest <path/to/manifest.json> [...more]')
  process.exit(2)
}

function problemsIn(manifest) {
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

  if (Object.keys(manifest.components ?? {}).length === 0) {
    problems.push('manifest.components is empty')
  }

  const { anonymous, undocumented, assetsMissing } = manifestDiagnostics(manifest)

  for (const test of anonymous) {
    problems.push(`${test.fullName}: anonymous component`)
  }

  for (const component of undocumented) {
    problems.push(`${component.name}: no props docs (${component.tests} tests)`)
  }

  for (const path of assetsMissing) {
    problems.push(`${path}: asset not found`)
  }

  return { tests, problems }
}

let failed = false

for (const path of paths) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const { tests, problems } = problemsIn(manifest)

  if (problems.length > 0) {
    failed = true

    console.error(
      `check-manifest: ${path}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`,
    )

    continue
  }

  const frames = tests.flatMap((test) => test.frames).length
  const documented = Object.keys(manifest.components).length

  console.log(
    `check-manifest: ok — ${path}: ${tests.length} tests, ${frames} frames, ${documented} components documented`,
  )
}

if (failed) {
  process.exit(1)
}
