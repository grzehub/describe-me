import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'
import type { DescribeMeOptions } from '@describe-me/vitest/plugin'

// BENCH_OUT=<file> swaps the console reporter for JSON with per-test durations.
const benchOut = process.env.BENCH_OUT

// ACT_PARITY=1 runs the fixtures of `pnpm check-act-parity`, with lazy render
// frames so that every wait of the recorder runs.
const actParity = Boolean(process.env.ACT_PARITY)

function testFiles(): string[] {
  if (actParity) {
    return ['act-parity/**/*.test.tsx']
  }

  if (process.env.BENCH_MICRO) {
    return ['bench/**/*.test.tsx']
  }

  return ['src/**/*.test.tsx']
}

// DESCRIBE_ME=idle installs the plugin but records nothing. It writes to a
// scratch directory, because its GC would otherwise empty `.describe-me/`.
const idle = process.env.DESCRIBE_ME === 'idle'

// BENCH_SKIP=<list> switches parts of the plugin off in an idle run: `css` sets
// `test.css: false`, `styled` the styled-components browser build, `exports`
// the registerExports transform.
const benchSkips = ['css', 'styled', 'exports']
const skipped = (process.env.BENCH_SKIP ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

for (const name of skipped) {
  if (!benchSkips.includes(name)) {
    throw new Error(`BENCH_SKIP: unknown value "${name}", expected ${benchSkips.join(', ')}`)
  }
}

// A recording run with parts switched off would overwrite `.describe-me/`
// with poorer snapshots.
if (skipped.length > 0 && !idle) {
  throw new Error('BENCH_SKIP works only with DESCRIBE_ME=idle')
}

function benchOptions(): DescribeMeOptions {
  if (!idle) {
    return {}
  }

  return {
    exclude: '**',
    outDir: 'node_modules/.describe-me-idle',
    ...(skipped.includes('styled') ? { styledComponentsBrowserBuild: false } : {}),
    ...(skipped.includes('exports') ? { registerExports: false } : {}),
  }
}

// The font an app shell would load. Lora comes from fonts.css instead, which
// Postcard.tsx imports like any other stylesheet.
const previewHead = `
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
`

// Same shape as a typical jsdom design-system setup (globals included). The
// plugin detects the DOM environment on its own: no browser block, so it
// registers the jsdom setup file, redirects @testing-library/react to the
// recording adapter and turns on CSS processing.
export default defineConfig({
  // DESCRIBE_ME=off runs the same tests without the plugin, e.g. to compare act
  // warnings. DESCRIBE_ME=idle runs them with the plugin but without recording.
  plugins: [
    react(),
    describeMe({
      enabled: process.env.DESCRIBE_ME !== 'off',
      previewHead,
      renderFrame: actParity ? 'lazy' : 'eager',
      ...benchOptions(),
    }),
  ],
  test: {
    environment: 'jsdom',
    ...(skipped.includes('css') ? { css: false } : {}),
    globals: true,
    include: testFiles(),
    ...(benchOut ? { reporters: [['json', { outputFile: benchOut }]] } : {}),
  },
})
