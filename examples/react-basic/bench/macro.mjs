import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const RUNS = Number(process.argv[2] ?? 5)
const variants = { off: { DESCRIBE_ME: 'off' }, on: {} }
const results = {}
for (const [name, env] of Object.entries(variants)) {
  results[name] = { wall: [], tests: {}, sum: [] }
  for (let i = 0; i < RUNS; i++) {
    const out = `${process.cwd()}/.describe-me/bench-${name}-${i}.json`
    const t0 = performance.now()
    execSync('pnpm exec vitest run', {
      stdio: 'ignore',
      env: { ...process.env, ...env, BENCH_OUT: out },
    })

    results[name].wall.push(performance.now() - t0)
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

const manifest = JSON.parse(readFileSync('.describe-me/manifest.json', 'utf8'))
const frames = Object.fromEntries(
  manifest.modules.flatMap((mod) =>
    mod.tests.map((test) => [test.fullName.replace(/ > /g, ' '), test.frames.length]),
  ),
)

console.log(`runs per variant: ${RUNS}`)
console.log(
  `wall clock (median ms)      off=${median(results.off.wall).toFixed(0)}  on=${median(results.on.wall).toFixed(0)}  diff=${(median(results.on.wall) - median(results.off.wall)).toFixed(0)}`,
)

console.log(
  `sum of test durations (ms)  off=${median(results.off.sum).toFixed(0)}  on=${median(results.on.sum).toFixed(0)}  diff=${(median(results.on.sum) - median(results.off.sum)).toFixed(0)}`,
)

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
