/**
 * One case of `pnpm check-typescript`, in a process of its own, because Node
 * keeps a module once it has loaded it. Puts the case's stand-in for
 * `typescript` in front of the real one, then reads the props of the fixture
 * project three times: with no rendered component, then twice with one. For
 * each read it prints the result, the warnings and how often `typescript` was
 * resolved, as JSON on stdout.
 *
 * Usage: `node scripts/check-typescript/read-props.mjs <case> <fixture dir>`
 */
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [kind, fixture] = process.argv.slice(2)

/** What each case resolves `typescript` to. `installed` keeps the real TypeScript 6. */
const STAND_INS = {
  installed: null,
  'typescript-7': join(fixture, 'typescript-7', 'lib', 'version.cjs'),
  broken: join(fixture, 'typescript-broken', 'index.cjs'),
  missing: 'missing',
}

const standIn = STAND_INS[kind]

if (standIn === undefined) {
  throw new Error(`read-props: unknown case "${kind}"`)
}

let resolved = 0

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier !== 'typescript') {
      return nextResolve(specifier, context)
    }

    resolved++

    if (standIn === null) {
      return nextResolve(specifier, context)
    }

    if (standIn === 'missing') {
      const error = new Error("Cannot find package 'typescript'")
      error.code = 'ERR_MODULE_NOT_FOUND'
      throw error
    }

    return { url: pathToFileURL(standIn).href, format: 'commonjs', shortCircuit: true }
  },
})

let warnings = []
console.warn = (...args) => warnings.push(args.join(' '))

const { collectComponentDocsSafely } =
  await import('../../packages/vitest/dist/collect-component-docs-safely.js')

const root = join(fixture, 'project')
const entry = { testFile: join(root, 'src', 'Button.test.tsx'), componentName: 'Button' }
const reads = []

for (const entries of [[], [entry], [entry]]) {
  warnings = []
  resolved = 0

  const result = await collectComponentDocsSafely(root, entries)

  reads.push({ result, warnings, resolved })
}

console.log(JSON.stringify(reads))
