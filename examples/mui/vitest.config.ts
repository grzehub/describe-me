import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

// MUI_CSS_VARS=1 builds the theme with `cssVariables: true` and writes to an output
// directory of its own, so `.describe-me/` keeps the default run.
const cssVariables = Boolean(process.env.MUI_CSS_VARS)

if (cssVariables && process.env.MUI_CSS_VARS !== '1') {
  throw new Error(`MUI_CSS_VARS: unknown value "${process.env.MUI_CSS_VARS}", expected 1`)
}

export default defineConfig({
  plugins: [
    react(),
    describeMe(cssVariables ? { outDir: 'node_modules/.describe-me-css-vars' } : {}),
  ],
  // Live runs src/theme.ts in the browser, where `process` does not exist.
  define: { 'process.env.MUI_CSS_VARS': JSON.stringify(cssVariables ? '1' : '') },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx'],
  },
})
