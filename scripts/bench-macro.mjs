/**
 * Measures what recording costs a whole suite: `vitest run` with
 * `DESCRIBE_ME=off` against a recording run, as wall clock, sum of test
 * durations and per test. The variants alternate in each iteration, so warm-up
 * and machine load hit both alike. Reads and writes `.describe-me/` in the
 * current directory, and needs a config that honours `BENCH_OUT`.
 * Both variants report through the JSON reporter the config picks for
 * `BENCH_OUT`, so the console reporter Vitest picks per environment never
 * differs between them. Never pass `--reporter`: it would drop describe-me's
 * reporter from the recording run.
 * Usage, from an example directory: `node ../../scripts/bench-macro.mjs [runs]`
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'

const RUNS = Number(process.argv[2] ?? 5)
const variants = { off: { DESCRIBE_ME: 'off' }, on: {} }
const results = {}

for (const name of Object.keys(variants)) {
  results[name] = { wall: [], tests: {}, sum: [] }
}

for (let i = 0; i < RUNS; i++) {
  for (const [name, env] of Object.entries(variants)) {
    const out = `${process.cwd()}/.describe-me/bench-${name}-${i}.json`
    rmSync(out, { force: true })
    const t0 = performance.now()
    execSync('pnpm exec vitest run', {
      stdio: 'ignore',
      env: { ...process.env, ...env, BENCH_OUT: out },
    })

    results[name].wall.push(performance.now() - t0)

    if (!existsSync(out)) {
      throw new Error(
        `bench-macro: the ${name} variant wrote no ${out}. The config must replace its reporters with a JSON reporter when BENCH_OUT is set.`,
      )
    }

    const json = JSON.parse(readFileSync(out, 'utf8'))
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
}

const median = (xs) => {
  const sorted = [...xs].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

const spread = (xs) => {
  const sorted = [...xs].sort((left, right) => left - right)
  return `${median(xs).toFixed(0)} [${sorted[0].toFixed(0)}–${sorted.at(-1).toFixed(0)}]`
}

const summary = (label, key) => {
  const diff = median(results.on[key]) - median(results.off[key])

  console.log(
    `${label.padEnd(28)} off=${spread(results.off[key])}  on=${spread(results.on[key])}  diff=${diff.toFixed(0)}`,
  )
}

const manifest = JSON.parse(readFileSync('.describe-me/manifest.json', 'utf8'))
const frames = Object.fromEntries(
  manifest.modules.flatMap((mod) =>
    mod.tests.map((test) => [test.fullName.replace(/ > /g, ' '), test.frames.length]),
  ),
)

console.log(`runs per variant: ${RUNS}, interleaved`)
console.log('median [min–max] in ms')
summary('wall clock', 'wall')
summary('sum of test durations', 'sum')

console.log('\nper test (median ms):  off | on | diff | frames | diff/frame')
let totalDiff = 0,
  totalFrames = 0

for (const key of Object.keys(results.on.tests)) {
  const off = median(results.off.tests[key]),
    on = median(results.on.tests[key])

  const frameCount =
    frames[key] ??
    frames[
      Object.keys(frames).find((frameKey) => key.endsWith(frameKey.split(' ').slice(-3).join(' ')))
    ] ??
    '?'

  totalDiff += on - off
  if (typeof frameCount === 'number') {
    totalFrames += frameCount
  }

  console.log(
    `  ${key.padEnd(62)} ${String(off).padStart(4)} | ${String(on).padStart(4)} | ${String(on - off).padStart(4)} | ${String(frameCount).padStart(2)} | ${typeof frameCount === 'number' ? ((on - off) / frameCount).toFixed(1) : '?'}`,
  )
}

console.log(
  `\noverall: +${totalDiff.toFixed(0)}ms over ${totalFrames} frames = ${(totalDiff / totalFrames).toFixed(1)} ms/frame`,
)
