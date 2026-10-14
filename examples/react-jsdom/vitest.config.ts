import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'
import type { DescribeMeOptions } from '@describe-me/vitest/plugin'

// BENCH_OUT=<file> swaps the console reporter for JSON with per-test durations.
const benchOut = process.env.BENCH_OUT

// ACT_PARITY=1 runs the fixtures of `pnpm check-act-parity`, with lazy render
// frames so that every wait of the recorder runs. ACT_PARITY=eager takes render
// frames right away and loads Testing Library in a setup file before ours.
const actParity = Boolean(process.env.ACT_PARITY)
const actParityEager = process.env.ACT_PARITY === 'eager'

// LIVE_FIXTURES=1 runs the fixtures of `pnpm check-live` in live-fixtures/,
// with their own setup files and output directory. `pnpm check-live` loads the
// config for the live preview with two more values, which reuse that output:
// LIVE_FIXTURES=no-live-setup leaves out `live`, LIVE_FIXTURES=off sets `live: false`.
const liveFixtures = process.env.LIVE_FIXTURES || null
const liveFixtureModes = ['1', 'no-live-setup', 'off']

if (liveFixtures !== null && !liveFixtureModes.includes(liveFixtures)) {
  throw new Error(
    `LIVE_FIXTURES: unknown value "${liveFixtures}", expected ${liveFixtureModes.join(', ')}`,
  )
}

if (liveFixtures !== null && (actParity || process.env.BENCH_MICRO)) {
  throw new Error('LIVE_FIXTURES does not work with ACT_PARITY or BENCH_MICRO')
}

// PROJECTS=1 runs src/ and projects/ as three inline projects. `components`
// extends the root config with `extends: true`, `plain` without it, because
// Vitest 5 extends an inline project by default. Both share the root's Vite
// server. `plain` takes jsdom and globals from the root, so its tests fail if
// it stops inheriting. `isolated` has `extends: false` and no describe-me, so
// Testing Library must still clean up after its tests. It writes to an output
// directory of its own, for `pnpm check-projects`.
const projects = process.env.PROJECTS || null

if (projects !== null && projects !== '1') {
  throw new Error(`PROJECTS: unknown value "${projects}", expected 1`)
}

if (projects !== null && (liveFixtures !== null || actParity || process.env.BENCH_MICRO)) {
  throw new Error('PROJECTS does not work with LIVE_FIXTURES, ACT_PARITY or BENCH_MICRO')
}

function projectOptions(): DescribeMeOptions {
  return projects === null ? {} : { outDir: 'node_modules/.describe-me-projects' }
}

function testProjects() {
  if (projects === null) {
    return {}
  }

  return {
    projects: [
      { extends: true, test: { name: 'components', include: ['src/**/*.test.tsx'] } },
      { test: { name: 'plain', include: ['projects/leak.test.tsx'] } },
      {
        extends: false,
        plugins: [react()],
        test: {
          name: 'isolated',
          environment: 'jsdom',
          globals: true,
          include: ['projects/isolated.test.tsx'],
        },
      },
    ],
  }
}

// STORIES=all|tagged runs the fixtures of `pnpm check-stories` in stories/,
// with that `stories` option and an output directory of their own.
const stories = process.env.STORIES || null
const storiesModes = ['all', 'tagged']

if (stories !== null && !storiesModes.includes(stories)) {
  throw new Error(`STORIES: unknown value "${stories}", expected ${storiesModes.join(', ')}`)
}

if (
  stories !== null &&
  (liveFixtures !== null || actParity || process.env.BENCH_MICRO || projects !== null)
) {
  throw new Error('STORIES does not work with LIVE_FIXTURES, ACT_PARITY, BENCH_MICRO or PROJECTS')
}

function storiesOptions(): DescribeMeOptions {
  if (stories === null) {
    return {}
  }

  return {
    outDir: 'node_modules/.describe-me-stories',
    stories: stories as DescribeMeOptions['stories'],
  }
}

// A package entry covers the setup files that are bare specifiers.
const fixtureSetupFiles = [
  './live-fixtures/setup.ts',
  '@testing-library/dom',
  './live-fixtures/server.node.ts',
]

function liveFixtureOptions(): DescribeMeOptions {
  if (liveFixtures === null) {
    return {}
  }

  const outDir = 'node_modules/.describe-me-live-fixtures'

  if (liveFixtures === 'off') {
    return { outDir, live: false }
  }

  if (liveFixtures === 'no-live-setup') {
    return { outDir }
  }

  const setupFiles = fixtureSetupFiles.map((file) =>
    file.endsWith('server.node.ts') ? './live-fixtures/server.browser.ts' : file,
  )

  return { outDir, live: { setupFiles } }
}

function setupFiles(): { setupFiles?: string[] } {
  if (liveFixtures !== null) {
    return { setupFiles: fixtureSetupFiles }
  }

  return actParityEager ? { setupFiles: ['./act-parity/setup.ts'] } : {}
}

function renderFrame(): DescribeMeOptions['renderFrame'] {
  if (actParity && !actParityEager) {
    return 'lazy'
  }

  return 'eager'
}

function testFiles(): string[] {
  if (liveFixtures !== null) {
    return ['live-fixtures/**/*.test.tsx']
  }

  if (actParity) {
    return ['act-parity/**/*.test.tsx']
  }

  // Projects that extend the root config add its `include` to their own, so
  // only the projects name files.
  if (projects !== null) {
    return []
  }

  if (stories !== null) {
    return ['stories/**/*.test.tsx']
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
      renderFrame: renderFrame(),
      ...benchOptions(),
      ...liveFixtureOptions(),
      ...projectOptions(),
      ...storiesOptions(),
    }),
  ],
  test: {
    environment: 'jsdom',
    ...(skipped.includes('css') ? { css: false } : {}),
    ...setupFiles(),
    globals: true,
    include: testFiles(),
    ...testProjects(),
    ...(benchOut ? { reporters: [['json', { outputFile: benchOut }]] } : {}),
  },
})
