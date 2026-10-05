import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

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

// The fonts an app shell would load: Inter from Google Fonts and a local Lora,
// whose fonts.css is copied into the output with its font.
const previewHead = `
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/src/assets/fonts/fonts.css">
`

export default defineConfig({
  plugins: [
    react(),
    describeMe({
      enabled,
      previewHead,
      ...(idle ? { exclude: '**', outDir: 'node_modules/.describe-me-idle' } : {}),
    }),
  ],
  test: {
    include: process.env.BENCH_MICRO ? ['bench/**/*.test.tsx'] : ['src/**/*.test.tsx'],
    ...(benchOut ? { reporters: [['json', { outputFile: benchOut }]] } : {}),
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
