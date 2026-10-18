/**
 * Synthetic copies of example outputs for the preset cases of
 * check-foundations, each written into a directory of its own so that
 * `examples/` stays untouched: a Chakra UI project with custom properties
 * only, a Material UI project without a theme module or `--mui-*`, the
 * `MUI_CSS_VARS=1` output without its theme module, and mui's output with
 * a primary whose dark mode is Material UI's default.
 */
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** A Chakra UI project, from react-browser's output. */
export const CHAKRA_COPY = 'Chakra copy'

/** A Material UI project with neither a theme module nor `--mui-*`, from mui's output. */
export const MUI_WITHOUT_THEME = 'MUI without theme'

/** The `MUI_CSS_VARS=1` output without its theme module, so only `--mui-*` is left. */
export const MUI_VARIABLES_ONLY = '--mui-* only'

/** mui's output whose dark primary is Material UI's `#90caf9`, which src/theme.ts never has. */
export const MUI_DEFAULT_DARK_PRIMARY = 'MUI with a default dark primary'

const CHAKRA_ROOT = [
  ['--chakra-colors-gray-50', '#fafafa'],
  ['--chakra-colors-gray-500', '#71717a'],
  ['--chakra-colors-gray-900', '#18181b'],
  ['--chakra-colors-teal-500', '#14b8a6'],
  ['--chakra-colors-bg', '#ffffff'],
  ['--chakra-colors-fg', '#18181b'],
  ['--chakra-fonts-heading', 'Inter, sans-serif'],
  ['--chakra-fonts-body', 'Inter, sans-serif'],
  ['--chakra-font-sizes-sm', '0.875rem'],
  ['--chakra-font-sizes-md', '1rem'],
  ['--chakra-spacing-1', '0.25rem'],
  ['--chakra-spacing-2', '0.5rem'],
  ['--chakra-spacing-4', '1rem'],
  ['--chakra-radii-sm', '0.25rem'],
  ['--chakra-radii-md', '0.375rem'],
  ['--chakra-shadows-sm', '0 1px 2px rgb(0 0 0 / 0.1)'],
  ['--chakra-shadows-md', '0 4px 8px rgb(0 0 0 / 0.1)'],
  ['--chakra-durations-fast', '150ms'],
  ['--chakra-durations-slow', '300ms'],
  ['--brand', '#2b5cff'],
]

const CHAKRA_DARK = [
  ['--chakra-colors-bg', '#18181b'],
  ['--chakra-colors-fg', '#fafafa'],
]

function rule(selector, declarations) {
  const body = declarations.map(([name, value]) => `  ${name}: ${value};`).join('\n')

  return `${selector} {\n${body}\n}`
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Copy an output and rewrite its `foundations.json` and the manifest's summary. */
function copyWith(source, dir, foundationsOf, summaryOf) {
  cpSync(source, dir, { recursive: true })

  const foundationsFile = join(dir, 'foundations.json')
  const manifestFile = join(dir, 'manifest.json')
  const manifest = readJson(manifestFile)

  writeFileSync(foundationsFile, JSON.stringify(foundationsOf(readJson(foundationsFile))))
  manifest.foundations = summaryOf(manifest.foundations)
  writeFileSync(manifestFile, JSON.stringify(manifest))
}

function withoutTheme(foundations) {
  const copy = {
    ...foundations,
    tokens: foundations.tokens.filter((token) => token.source !== 'theme'),
  }

  delete copy.theme

  return copy
}

/** The Chakra copy of react-browser's output in `source`, written to `dir`. */
export function writeChakraCopy(source, dir) {
  const cssText = `${rule(':root', CHAKRA_ROOT)}\n${rule('.dark', CHAKRA_DARK)}`

  copyWith(
    source,
    dir,
    () => ({
      version: 1,
      systems: [{ id: 'chakra', package: '@chakra-ui/react', version: '3.0.0' }],
      tokenSheets: [{ cssText }],
      fontSheets: [],
      cssSources: [],
      tokens: [],
      errors: [],
      duration: 0,
    }),
    () => ({ systems: ['chakra'], tokens: CHAKRA_ROOT.length }),
  )
}

/** mui's output in `source` without its theme, with one custom property of its own. */
export function writeMuiWithoutTheme(source, dir) {
  copyWith(
    source,
    dir,
    (foundations) => ({
      ...withoutTheme(foundations),
      tokenSheets: [{ cssText: ':root { --app-accent: #5b4bdb }' }],
    }),
    // The one custom property puts a section next to the hint.
    () => ({ systems: ['mui', 'emotion'], tokens: 1 }),
  )
}

/** The `MUI_CSS_VARS=1` output in `source` without its theme module. */
export function writeMuiVariablesOnly(source, dir) {
  copyWith(source, dir, withoutTheme, (summary) => ({ ...summary, tokens: 232 }))
}

/** mui's output in `source`, with only the dark mode of `palette.primary.main` at the default. */
export function writeMuiDefaultDarkPrimary(source, dir) {
  const primary = {
    modes: { light: '#5b4bdb', dark: '#90caf9' },
    origin: 'project',
    modeOrigins: { light: 'project', dark: 'default' },
  }

  copyWith(
    source,
    dir,
    (foundations) => ({
      ...foundations,
      tokens: foundations.tokens.map((token) =>
        token.name === 'palette.primary.main' ? { ...token, ...primary } : token,
      ),
    }),
    (summary) => summary,
  )
}

/** Each copy by label: the output it is made from and how. */
export const COPIES = {
  [CHAKRA_COPY]: { from: 'react-browser', write: writeChakraCopy },
  [MUI_WITHOUT_THEME]: { from: 'mui', write: writeMuiWithoutTheme },
  [MUI_VARIABLES_ONLY]: { from: 'mui, MUI_CSS_VARS=1', write: writeMuiVariablesOnly },
  [MUI_DEFAULT_DARK_PRIMARY]: { from: 'mui', write: writeMuiDefaultDarkPrimary },
}
