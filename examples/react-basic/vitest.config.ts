import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

// DESCRIBE_ME=off runs the same tests without recording. Used for benchmarking.
const recording = process.env.DESCRIBE_ME !== 'off'
// BENCH_OUT=<file> swaps the console reporter for JSON with per-test durations.
const benchOut = process.env.BENCH_OUT

export default defineConfig({
  plugins: [react(), describeMe({ enabled: recording })],
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
