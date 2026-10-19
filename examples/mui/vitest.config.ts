import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

// MUI_CLASSIC=1 builds the theme without `cssVariables`, so the recorded CSS holds only the light
// scheme's colors, and writes to an output directory of its own, so `.describe-me/` keeps the
// default run.
const classic = Boolean(process.env.MUI_CLASSIC)

if (classic && process.env.MUI_CLASSIC !== '1') {
  throw new Error(`MUI_CLASSIC: unknown value "${process.env.MUI_CLASSIC}", expected 1`)
}

// MUI_THEME=off builds the classic theme and leaves out `foundations.theme`, as a plain Material
// UI project does, and writes to an output directory of its own, so Foundations shows only its
// setup hint there.
const withoutTheme = Boolean(process.env.MUI_THEME)

if (withoutTheme && process.env.MUI_THEME !== 'off') {
  throw new Error(`MUI_THEME: unknown value "${process.env.MUI_THEME}", expected off`)
}

if (withoutTheme && classic) {
  throw new Error('MUI_THEME: off does not combine with MUI_CLASSIC=1')
}

function outDir(): { outDir?: string } {
  if (classic) {
    return { outDir: 'node_modules/.describe-me-classic' }
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
  // Live runs src/theme.ts in the browser, where `process` does not exist. The MUI_THEME=off run
  // relies on it too, because its environment has no MUI_CLASSIC.
  define: { 'process.env.MUI_CLASSIC': JSON.stringify(classic || withoutTheme ? '1' : '') },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx'],
  },
})
