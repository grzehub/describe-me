import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

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
  // DESCRIBE_ME=off runs the same tests without recording, e.g. to compare act warnings.
  plugins: [react(), describeMe({ enabled: process.env.DESCRIBE_ME !== 'off', previewHead })],
  test: {
    environment: 'jsdom',
    globals: true,
    include: process.env.BENCH_MICRO ? ['bench/**/*.test.tsx'] : ['src/**/*.test.tsx'],
  },
})
