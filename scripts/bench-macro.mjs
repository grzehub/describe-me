/**
 * Measures what the plugin and recording cost a whole suite, as wall clock, sum
 * of test durations and per test. Variants:
 *
 * - `off`: `DESCRIBE_ME=off`, no plugin.
 * - `idle`: `DESCRIBE_ME=idle`, the plugin with `exclude: '**'`, recording nothing.
 * - `idle-no-css`, `idle-no-styled`, `idle-no-exports`: `idle` with `BENCH_SKIP`
 *   switching off `test.css`, the styled-components browser build or the
 *   registerExports transform (examples/react-jsdom only).
 * - `on`: recording.
 *
 * One uncounted warm-up iteration runs every variant first, so the first one
 * does not pay for a cold Vite cache alone. Each measured iteration then runs
 * every variant once, starting one variant later than the previous iteration,
 * so warm-up and machine load hit all of them alike. Reads and writes
 * `.describe-me/` in the current directory, and needs a config that honours
 * `BENCH_OUT`, `DESCRIBE_ME` and `BENCH_SKIP`.
 * Every variant reports through the JSON reporter the config picks for
 * `BENCH_OUT`, so the console reporter Vitest picks per environment never
 * differs between them. Never pass `--reporter`: it would drop describe-me's
 * reporter from the recording run.
 * Usage, from an example directory:
 * `node ../../scripts/bench-macro.mjs [runs] [variants]`, with comma-separated
 * variants, `off,idle,on` by default.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'

const knownVariants = {
  off: { DESCRIBE_ME: 'off' },
  idle: { DESCRIBE_ME: 'idle' },
  'idle-no-css': { DESCRIBE_ME: 'idle', BENCH_SKIP: 'css' },
  'idle-no-styled': { DESCRIBE_ME: 'idle', BENCH_SKIP: 'styled' },
  'idle-no-exports': { DESCRIBE_ME: 'idle', BENCH_SKIP: 'exports' },
  on: {},
}

const RUNS = Number(process.argv[2] ?? 5)
const names = (process.argv[3] ?? 'off,idle,on').split(',').filter(Boolean)

for (const name of names) {
  if (!(name in knownVariants)) {
    console.error(
      `bench-macro: unknown variant "${name}". Known variants: ${Object.keys(knownVariants).join(', ')}`,
    )

    process.exit(1)
  }
}

const baseEnv = { ...process.env }

delete baseEnv.DESCRIBE_ME
delete baseEnv.BENCH_SKIP
delete baseEnv.BENCH_MICRO
delete baseEnv.ACT_PARITY

const results = {}

for (const name of names) {
  results[name] = { wall: [], tests: {}, sum: [] }
}

function runVariant(name, iteration) {
  const out = `${process.cwd()}/.describe-me/bench-${name}-${iteration}.json`

  rmSync(out, { force: true })
  const t0 = performance.now()

  try {
    execSync('pnpm exec vitest run', {
      stdio: 'ignore',
      env: { ...baseEnv, ...knownVariants[name], BENCH_OUT: out },
    })
  } catch (error) {
    console.error(`bench-macro: vitest run failed in the ${name} variant (exit ${error.status}).`)
    process.exit(1)
  }

  const wall = performance.now() - t0

  if (!existsSync(out)) {
    throw new Error(
      `bench-macro: the ${name} variant wrote no ${out}. The config must replace its reporters with a JSON reporter when BENCH_OUT is set.`,
    )
  }

  return { wall, json: JSON.parse(readFileSync(out, 'utf8')) }
}

function record(name, { wall, json }) {
  results[name].wall.push(wall)
  let sum = 0

  for (const file of json.testResults) {
    for (const assertion of file.assertionResults) {
      const key = assertion.fullName

      ;(results[name].tests[key] ??= []).push(assertion.duration)
      sum += assertion.duration
    }
  }

  results[name].sum.push(sum)
}

for (const name of names) {
  runVariant(name, 'warmup')
}

for (let i = 0; i < RUNS; i++) {
  for (let j = 0; j < names.length; j++) {
    const name = names[(i + j) % names.length]

    record(name, runVariant(name, i))
  }
}

const median = (xs) => {
  const sorted = [...xs].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

const spread = (xs) => {
  const sorted = [...xs].sort((left, right) => left - right)
  return `${median(xs).toFixed(0)} [${sorted[0].toFixed(0)}–${sorted.at(-1).toFixed(0)}]`
}

function diff(name, against, key) {
  const delta = median(results[name][key]) - median(results[against][key])
  const percent = (delta / median(results[against][key])) * 100
  const sign = delta < 0 ? '' : '+'

  return `${sign}${delta.toFixed(0)} ms (${sign}${percent.toFixed(0)} %)`
}

function baselineOf(name) {
  if (name.startsWith('idle-')) {
    return 'idle'
  }

  if (name === 'idle') {
    return 'off'
  }

  if (name === 'on') {
    return 'idle' in results ? 'idle' : 'off'
  }

  return undefined
}

console.log(`runs per variant: ${RUNS}, interleaved, after one warm-up run`)
console.log('median [min–max] in ms')

for (const name of names) {
  const baseline = baselineOf(name)
  const line = `${name.padEnd(16)} wall=${spread(results[name].wall).padEnd(20)} tests=${spread(results[name].sum).padEnd(18)}`

  if (baseline && baseline in results) {
    console.log(
      `${line} vs ${baseline}: wall ${diff(name, baseline, 'wall')}, tests ${diff(name, baseline, 'sum')}`,
    )
  } else {
    console.log(line)
  }
}

function costLine(label, name, against) {
  if (!(name in results) || !(against in results)) {
    return
  }

  console.log(
    `${label.padEnd(30)} wall ${diff(name, against, 'wall')}, tests ${diff(name, against, 'sum')}`,
  )
}

console.log('')
costLine('plugin cost (idle − off)', 'idle', 'off')
costLine('recording cost (on − idle)', 'on', 'idle')

if (!('on' in results)) {
  process.exit(0)
}

const reference = 'idle' in results ? 'idle' : 'off'

if (!(reference in results)) {
  process.exit(0)
}

const manifest = JSON.parse(readFileSync('.describe-me/manifest.json', 'utf8'))
const frames = Object.fromEntries(
  manifest.modules.flatMap((mod) =>
    mod.tests.map((test) => [test.fullName.replace(/ > /g, ' '), test.frames.length]),
  ),
)

console.log(`\nper test (median ms):  ${reference} | on | diff | frames | diff/frame`)
let totalDiff = 0,
  totalFrames = 0

for (const key of Object.keys(results.on.tests)) {
  const base = median(results[reference].tests[key]),
    on = median(results.on.tests[key])

  const frameCount =
    frames[key] ??
    frames[
      Object.keys(frames).find((frameKey) => key.endsWith(frameKey.split(' ').slice(-3).join(' ')))
    ] ??
    '?'

  totalDiff += on - base
  if (typeof frameCount === 'number') {
    totalFrames += frameCount
  }

  console.log(
    `  ${key.padEnd(62)} ${base.toFixed(1).padStart(6)} | ${on.toFixed(1).padStart(6)} | ${(on - base).toFixed(1).padStart(6)} | ${String(frameCount).padStart(2)} | ${typeof frameCount === 'number' ? ((on - base) / frameCount).toFixed(1) : '?'}`,
  )
}

console.log(
  `\noverall: +${totalDiff.toFixed(0)}ms over ${totalFrames} frames = ${(totalDiff / totalFrames).toFixed(1)} ms/frame`,
)
