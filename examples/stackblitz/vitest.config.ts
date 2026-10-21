import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

// The plugin sees the jsdom environment and sets itself up for it: the
// recording `render` of @testing-library/react, CSS in the snapshots and the
// tokens of src/tokens.css in Foundations.
export default defineConfig({
  plugins: [react(), describeMe()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx'],
  },
})
