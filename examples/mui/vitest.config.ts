import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

// MUI_CSS_VARS=1 builds the theme with `cssVariables: true` and writes to an output
// directory of its own, so `.describe-me/` keeps the default run.
const cssVariables = Boolean(process.env.MUI_CSS_VARS)

if (cssVariables && process.env.MUI_CSS_VARS !== '1') {
  throw new Error(`MUI_CSS_VARS: unknown value "${process.env.MUI_CSS_VARS}", expected 1`)
}

// MUI_THEME=off leaves out `foundations.theme`, as a plain Material UI project does, and writes
// to an output directory of its own, so Foundations shows only its setup hint there.
const withoutTheme = Boolean(process.env.MUI_THEME)

if (withoutTheme && process.env.MUI_THEME !== 'off') {
  throw new Error(`MUI_THEME: unknown value "${process.env.MUI_THEME}", expected off`)
}

if (withoutTheme && cssVariables) {
  throw new Error('MUI_THEME: off does not combine with MUI_CSS_VARS=1')
}

function outDir(): { outDir?: string } {
  if (cssVariables) {
    return { outDir: 'node_modules/.describe-me-css-vars' }
  }

  return withoutTheme ? { outDir: 'node_modules/.describe-me-no-theme' } : {}
}

export default defineConfig({
  plugins: [
    react(),
    describeMe({
      ...(withoutTheme ? {} : { foundations: { theme: 'src/theme.ts' } }),
      ...outDir(),
    }),
  ],
  // Live runs src/theme.ts in the browser, where `process` does not exist.
  define: { 'process.env.MUI_CSS_VARS': JSON.stringify(cssVariables ? '1' : '') },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx'],
  },
})
