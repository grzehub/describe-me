import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

// Same shape as a typical jsdom design-system setup (globals included). The
// plugin detects the DOM environment on its own: no browser block, so it
// registers the jsdom setup file, redirects @testing-library/react to the
// recording adapter and turns on CSS processing.
export default defineConfig({
  plugins: [react(), describeMe()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx'],
  },
})
