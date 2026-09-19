import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import DescribeMeReporter from '@describe-me/vitest/reporter'

// DESCRIBE_ME=off runs the same tests without recording (recorder never begins,
// so every capture() is a no-op). Used for benchmarking.
const recording = process.env.DESCRIBE_ME !== 'off'
// BENCH_OUT=<file> adds the JSON reporter for per-test durations.
const benchOut = process.env.BENCH_OUT

export default defineConfig({
  plugins: [react()],
  test: {
    include: process.env.BENCH_MICRO ? ['bench/**/*.test.tsx'] : ['src/**/*.test.tsx'],
    setupFiles: recording ? ['@describe-me/vitest/setup'] : [],
    reporters: [
      benchOut ? ['json', { outputFile: benchOut }] : 'default',
      ...(recording ? [new DescribeMeReporter()] : []),
    ],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
