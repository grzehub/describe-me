import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'
import { splitCssPlugin } from './live-fixtures/split-css-plugin.js'

// DESCRIBE_ME=off runs the same tests without the plugin, DESCRIBE_ME=idle with
// the plugin but without recording. Used for benchmarking. The idle run writes
// to a scratch directory, because its GC would otherwise empty `.describe-me/`.
const enabled = process.env.DESCRIBE_ME !== 'off'
const idle = process.env.DESCRIBE_ME === 'idle'
// BENCH_OUT=<file> swaps the console reporter for JSON with per-test durations.
const benchOut = process.env.BENCH_OUT

if (process.env.BENCH_SKIP) {
  throw new Error('BENCH_SKIP works in examples/react-jsdom only')
}

// LIVE_FIXTURES=1 runs the fixtures of `pnpm check-live` in live-fixtures/,
// with their own setup file and output directory, and a CSS plugin split in
// two by `apply`, as @tailwindcss/vite is.
const liveFixtures = Boolean(process.env.LIVE_FIXTURES)

if (liveFixtures && process.env.LIVE_FIXTURES !== '1') {
  throw new Error(
    `LIVE_FIXTURES: unknown value "${process.env.LIVE_FIXTURES}", expected 1 (no-live-setup and off work in examples/react-jsdom only)`,
  )
}

if (liveFixtures && process.env.BENCH_MICRO) {
  throw new Error('LIVE_FIXTURES does not work with BENCH_MICRO')
}

function testFiles(): string[] {
  if (liveFixtures) {
    return ['live-fixtures/**/*.test.tsx']
  }

  if (process.env.BENCH_MICRO) {
    return ['bench/**/*.test.tsx']
  }

  return ['src/**/*.test.tsx']
}

// The fonts an app shell would load: Inter from Google Fonts and a local Lora,
// whose fonts.css is copied into the output with its font.
const previewHead = `
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/src/assets/fonts/fonts.css">
`

// A file joins the first key that matches it, so the narrower Components/Inputs
// comes before Components. Naming.test.tsx matches no key and stays ungrouped.
const sidebar = {
  groups: {
    'Components/Inputs': 'src/{Counter,SearchBox}.test.tsx',
    Components: 'src/{Button,Chip,Counter,Menu,SearchBox}.test.tsx',
    Postcard: 'src/Postcard.test.tsx',
    Styles: 'src/StyledText.test.tsx',
  },
}

export default defineConfig({
  plugins: [
    react(),
    ...(liveFixtures ? splitCssPlugin() : []),
    describeMe({
      enabled,
      previewHead,
      // The idle and live fixture runs record no file of src/ into their own
      // directories, where every group would warn that it stays empty.
      ...(liveFixtures || idle ? {} : { sidebar }),
      ...(idle ? { exclude: '**', outDir: 'node_modules/.describe-me-idle' } : {}),
      ...(liveFixtures ? { outDir: 'node_modules/.describe-me-live-fixtures' } : {}),
    }),
  ],
  test: {
    include: testFiles(),
    // A tag of the project's own, which the viewer shows and filters by.
    tags: [{ name: 'forms', description: 'form controls' }],
    ...(liveFixtures ? { setupFiles: ['./live-fixtures/setup.ts'] } : {}),
    ...(benchOut ? { reporters: [['json', { outputFile: benchOut }]] } : {}),
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
