/**
 * Checks the design-system foundations that the reporter writes to
 * `foundations.json`, on the built packages. Unit cases cover the
 * `foundations` option, the scan for root custom properties (with a 1 MB
 * adversarial input), `light-dark()` splitting, the plain-object adapter with
 * its type styles, `manifestDiagnostics`, and `muiDefaultOptions` with the
 * real `createTheme()` of examples/mui. `collectFoundations` runs on temp roots with an injected
 * module import: a missing theme file, a module without the export, a
 * throwing import whose message names the temp root, Tailwind 4 without
 * `@tailwindcss/node`, and a `@mui/material/styles` that throws on import,
 * has no `createTheme` or has one that throws must each give exactly one
 * sentence without a machine path, and the other sources must still be
 * collected. A Material UI theme whose dark primary is Material UI's default
 * must give that token `modeOrigins`. The reporter, driven without a real
 * Vitest, must remove a stale file with `foundations: false`, write nothing
 * for a run without tokens, problems and Material UI, write the file and a
 * summary at 0 tokens for a Material UI project without tokens, and say that
 * it cannot import a theme module without Vitest's module runner.
 *
 * Then it runs `examples/mui` with `MUI_CLASSIC=1` and with `MUI_THEME=off`,
 * and checks the output of every example: shadcn with its Tailwind 4 theme and
 * components.json, MUI with its theme module and Material UI's defaults on CSS
 * variables and on the classic theme, MUI without its theme module,
 * react-jsdom with its plain theme object and react-browser with its custom
 * properties only. Every chunk that `foundations.json` names must exist, no
 * file may name the checkout or the home directory, and no manifest may carry
 * foundations errors. Then `check-foundations/check-view.mjs` opens a static
 * build of the viewer for every output in Chromium and checks the Foundations
 * view: the entry, the sections and counts, resolved values, the dark variant,
 * fonts, the inspector, the frame's height, the viewer theme, the link and
 * narrow widths, a copy of react-browser's output without foundations, the MUI
 * output without its theme module, whose page holds only the setup hint, and
 * the stage's note on the classic MUI output, whose frame has only a light
 * variant. `check-foundations/check-presets.mjs` adds the design-system blocks
 * of every output, the `default` badges of Material UI per section under both
 * backgrounds, the WCAG contrast of pair tiles, the token filter and `/`, and
 * synthetic copies: a Chakra UI project, a project whose type styles are
 * custom properties named `--<style>-<part>`, a project whose plain theme
 * module holds type styles, a Material UI project without a theme module,
 * which shows the setup hint, MUI's output without its theme module, and the
 * classic MUI output with a default dark primary. It prints how long
 * collecting took per output. Run after `pnpm build` and every example's
 * tests. Exits 1 on any failure.
 *
 * Usage: node scripts/check-foundations.mjs
 */
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'
import { collectFoundations } from '../packages/vitest/dist/collect-foundations.js'
import { objectThemeTokens } from '../packages/vitest/dist/object-theme-tokens.js'
import { muiDefaultOptions } from '../packages/vitest/dist/mui-default-options.js'
import { describeMe } from '../packages/vitest/dist/plugin.js'
import { ProjectPaths } from '../packages/vitest/dist/project-paths.js'
import { RecordedSheets } from '../packages/vitest/dist/recorded-sheets.js'
import DescribeMeReporter from '../packages/vitest/dist/reporter.js'
import { rootCustomProperties } from '../packages/vitest/dist/root-custom-properties.js'
import { splitLightDark } from '../packages/vitest/dist/split-light-dark.js'
import { validateFoundations } from '../packages/vitest/dist/validate-foundations.js'
import { checkView } from './check-foundations/check-view.mjs'
import { machinePathsIn } from './docs/machine-paths-in.mjs'

// A pnpm bin shim puts the workspace's packages on NODE_PATH, where the
// Tailwind case would find the real @tailwindcss/node. Node reads it at start.
if (process.env.NODE_PATH) {
  const env = { ...process.env }
  delete env.NODE_PATH
  const rerun = spawnSync(process.execPath, process.argv.slice(1), { env, stdio: 'inherit' })
  process.exit(rerun.status ?? 1)
}

const REPO = fileURLToPath(new URL('..', import.meta.url))
const EXAMPLES = join(REPO, 'examples')
const MUI_STYLES = '@mui/material/styles'
const STYLE_REFERENCE = /^describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)$/
const STYLE_HASHES = /describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)/g
const ADVERSARIAL_MS = 200
const DARK_MEDIA = '@media (prefers-color-scheme: dark)'

/** Every output the examples write, with its directory relative to `examples/`. */
const OUTPUTS = {
  'react-browser': 'react-browser/.describe-me',
  'react-jsdom': 'react-jsdom/.describe-me',
  shadcn: 'shadcn/.describe-me',
  mui: 'mui/.describe-me',
  'mui, MUI_CLASSIC=1': 'mui/node_modules/.describe-me-classic',
  'mui, MUI_THEME=off': 'mui/node_modules/.describe-me-no-theme',
}

/** The tokens of examples/mui/src/theme.ts that differ from Material UI's defaults, in file order. */
const MUI_PROJECT_TOKENS = [
  'palette.primary.main',
  'palette.primary.light',
  'palette.primary.dark',
  'palette.secondary.main',
  'palette.secondary.light',
  'palette.secondary.dark',
  'typography.h1',
  'typography.button',
  'shape.borderRadius',
]

const MUI_DEFAULT_COUNT = 125

/** The options that give Material UI's defaults with the example's light and dark schemes. */
const MUI_EXAMPLE_OPTIONS = {
  colorSchemes: { light: true, dark: true },
  defaultColorScheme: 'light',
}

const directories = []
let checks = 0
let failures = 0

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/** `run` returns a boolean or `{ passed, detail }`, or a promise of one. Throwing fails. */
async function check(name, run) {
  let outcome

  try {
    outcome = await run()
  } catch (error) {
    outcome = { passed: false, detail: `threw: ${errorMessage(error)}` }
  }

  const { passed, detail } = typeof outcome === 'boolean' ? { passed: outcome } : outcome
  checks++

  if (passed) {
    console.log(`ok    ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail === undefined ? '' : ` (${detail})`}`)
  }
}

function same(actual, expected) {
  return {
    passed: isDeepStrictEqual(actual, expected),
    detail: `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  }
}

function throwsWith(run, prefix) {
  try {
    run()
  } catch (error) {
    const message = errorMessage(error)

    return { passed: message.startsWith(prefix), detail: message }
  }

  return { passed: false, detail: 'did not throw' }
}

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'describe-me-foundations-'))
  directories.push(dir)

  return dir
}

function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function element(tagName, attributes, childNodes = []) {
  return { type: 2, tagName, attributes, childNodes }
}

/** An rrweb document whose head holds the given `<style>` attributes. */
function snapshotWith(styles) {
  return {
    type: 0,
    childNodes: [
      element('html', {}, [
        element(
          'head',
          {},
          styles.map((attributes) => element('style', attributes)),
        ),
        element('body', {}, []),
      ]),
    ],
  }
}

// ---------- the option ----------

async function checkOption() {
  await check('validateFoundations returns for undefined, false, {} and a theme with #export', () =>
    same([undefined, false, {}, { theme: 'src/theme.ts#tokens' }].map(validateFoundations), [
      { enabled: true },
      { enabled: false },
      { enabled: true },
      { enabled: true, theme: { file: 'src/theme.ts', exportName: 'tokens' } },
    ]),
  )

  await check(
    'validateFoundations allows #default, splits at the last # and ignores other keys',
    () =>
      same(
        [
          { theme: 'src/theme.ts#default' },
          { theme: 'src/a#b/theme.ts#theme' },
          { theme: 'src/theme.ts', other: 1 },
        ].map(validateFoundations),
        [
          { enabled: true, theme: { file: 'src/theme.ts', exportName: 'default' } },
          { enabled: true, theme: { file: 'src/a#b/theme.ts', exportName: 'theme' } },
          { enabled: true, theme: { file: 'src/theme.ts' } },
        ],
      ),
  )

  for (const value of [true, 'x']) {
    await check(`validateFoundations throws for ${JSON.stringify(value)}`, () =>
      throwsWith(
        () => validateFoundations(value),
        'describe-me: foundations must be false or { theme }',
      ),
    )
  }

  for (const theme of ['', 'a.ts#1x', '#theme', 'a.ts#']) {
    await check(`validateFoundations throws for { theme: ${JSON.stringify(theme)} }`, () =>
      throwsWith(
        () => validateFoundations({ theme }),
        'describe-me: foundations.theme must be a module path, optionally with #exportName, got',
      ),
    )
  }

  await check('the reporter checks the option in its constructor', () =>
    throwsWith(
      () => new DescribeMeReporter({ foundations: { theme: 'a.ts#1x' } }),
      'describe-me: foundations.theme',
    ),
  )

  await check('the plugin rejects a bad option in config(), before any test', async () => {
    try {
      await describeMe({ foundations: true }).config({ root: tempDir(), test: {} })
    } catch (error) {
      const message = errorMessage(error)

      return { passed: message.startsWith('describe-me: foundations must be'), detail: message }
    }

    return { passed: false, detail: 'did not throw' }
  })
}

// ---------- the CSS scan ----------

async function checkRootCustomProperties() {
  const counted = [
    ':root',
    ':host',
    ':root, :host',
    '.dark',
    '.light',
    'html',
    'html.dark',
    ':root[data-theme="dark"]',
    "[data-mui-color-scheme='dark']",
    '[data-theme=dark]',
    '[data-dark]',
    'body, :root',
  ]

  for (const selector of counted) {
    await check(`rootCustomProperties counts ${selector}`, () =>
      same(rootCustomProperties(`${selector} { --a: 1; color: red; --b: 2 }`), ['--a', '--b']),
    )
  }

  const ignored = [
    'body',
    '.btn',
    '*, ::before',
    '.dark\\:bg-x',
    '.dark .card',
    ':root > body',
    'html body',
    ':host(.dark)',
    '.darker',
    '[data-theme~="dark"]',
    '[aria-dark]',
    '@property --x',
    '@font-face',
  ]

  for (const selector of ignored) {
    await check(`rootCustomProperties ignores ${selector}`, () =>
      same(rootCustomProperties(`${selector} { --a: 1 }`), []),
    )
  }

  await check('rootCustomProperties reads inside @media, @layer, @supports and @container', () =>
    same(
      rootCustomProperties(
        '@layer theme { :root { --a: 1 } } @media (prefers-color-scheme: dark) { @supports (color: red) { @container (width > 1px) { :root { --b: 2 } } } } .x { --c: 3 }',
      ),
      ['--a', '--b'],
    ),
  )

  await check('rootCustomProperties skips braces in strings and comments', () =>
    same(
      rootCustomProperties(
        ':root { --a: "}"; /* } .x { */ --b: \'{\'; } /* :root { --c: 1 } */ .y { content: "{"; --d: 1 }',
      ),
      ['--a', '--b'],
    ),
  )

  await check('rootCustomProperties keeps a ; inside url(…) in one declaration', () =>
    same(
      rootCustomProperties(
        ':root { --icon: url(data:image/svg+xml;utf8,<svg></svg>); --after: 1; }',
      ),
      ['--icon', '--after'],
    ),
  )

  await check('rootCustomProperties lists each name once, in order of first appearance', () =>
    same(rootCustomProperties(':root { --b: 1; --a: 2 } .dark { --a: 3; --c: 4 }'), [
      '--b',
      '--a',
      '--c',
    ]),
  )

  const megabyte = 1024 * 1024
  const adversarial = {
    'an unclosed :root{ before [data- repeated': `:root{${'[data-'.repeat(megabyte / 6)}`,
    'a prelude of [data- repeated': `${'[data-'.repeat(megabyte / 6)}{--a:1}`,
    'a compound of [data-a] repeated': `${'[data-a]'.repeat(megabyte / 8)}{--a:1}`,
    'a list of :root, repeated': `${':root,'.repeat(megabyte / 6)}{--a:1}`,
    'nested blocks': `${':root{'.repeat(megabyte / 6)}`,
    'declarations without a colon': `:root{${'--a;'.repeat(megabyte / 4)}}`,
    'open parentheses': `:root{--a:${'('.repeat(megabyte)}}`,
  }

  for (const [label, css] of Object.entries(adversarial)) {
    await check(`rootCustomProperties scans 1 MB of ${label} in under ${ADVERSARIAL_MS} ms`, () => {
      const started = performance.now()
      rootCustomProperties(css)
      const elapsed = Math.round(performance.now() - started)

      return { passed: elapsed < ADVERSARIAL_MS, detail: `${elapsed} ms` }
    })
  }
}

// ---------- the adapters ----------

async function checkSplitLightDark() {
  await check('splitLightDark reads nested functions and extra spaces', () =>
    same(
      [
        splitLightDark('light-dark(rgb(17, 17, 17), rgb(237, 237, 237))'),
        splitLightDark('  light-dark(  #fff ,  color-mix(in srgb, red 50%, blue)  )  '),
      ],
      [
        { light: 'rgb(17, 17, 17)', dark: 'rgb(237, 237, 237)' },
        { light: '#fff', dark: 'color-mix(in srgb, red 50%, blue)' },
      ],
    ),
  )

  await check('splitLightDark gives null for anything else', () =>
    same(
      [
        '#fff',
        'light-dark(#fff)',
        'light-dark(#fff, #000, #111)',
        'light-dark(#fff, #000) extra(1)',
        'var(--x, light-dark(#fff, #000))',
      ].map(splitLightDark),
      [null, null, null, null, null],
    ),
  )
}

/** Every token as `name → group/type`, with `modes` when it has them. */
function classified(tokens) {
  return Object.fromEntries(
    tokens.map((token) => {
      const kind = token.type === undefined ? token.group : `${token.group}/${token.type}`

      return [token.name, token.modes ? [kind, token.modes] : kind]
    }),
  )
}

async function checkObjectAdapter() {
  const deep = { a: { b: { c: { d: { e: { f: { g: '1px' } } } } } } }
  const tooDeep = { a: { b: { c: { d: { e: { f: { g: { h: '1px' } } } } } } } }
  const theme = {
    colors: { ink: 'light-dark(#111, #eee)', brand: '#5b4bdb', veil: 'rgba(0, 0, 0, 0.5)' },
    tones: { clear: 'transparent', text: 'currentColor', mix: 'color-mix(in srgb, red, blue)' },
    shadows: { none: 'none' },
    elevation: { card: '0 1px 2px #0003, 0 2px 4px rgb(0 0 0 / 0.1)' },
    fonts: { body: 'Inter', mono: 'Menlo, monospace' },
    typography: {
      fontFamily: 'Lora',
      fontSize: { sm: '14px' },
      fontWeight: { bold: 700 },
      lineHeight: { tight: 1.2 },
      letterSpacing: { wide: '0.05em' },
    },
    motion: { fast: '150ms', slow: '.5s', ease: 'cubic-bezier(0.4, 0, 0.2, 1)', step: 'steps(4)' },
    space: [0, '4px', '0.5rem', '50%'],
    radii: { md: '8px' },
    breakpoints: { md: '768px' },
    zIndex: { modal: 1300 },
    misc: { label: 'hello', on: true, off: null, gone: undefined, fn() {}, sym: Symbol('x') },
    deep,
    tooDeep,
    map: new Map([['a', '#fff']]),
  }

  theme.self = theme

  const shared = { main: '#fff' }

  await check('the object adapter classifies by value, then by path', () =>
    same(classified(objectThemeTokens(theme).tokens), {
      'colors.ink': ['colors/color', { light: '#111', dark: '#eee' }],
      'colors.brand': 'colors/color',
      'colors.veil': 'colors/color',
      'tones.clear': 'colors/color',
      'tones.text': 'colors/color',
      'tones.mix': 'colors/color',
      'shadows.none': 'shadows/shadow',
      'elevation.card': 'shadows/shadow',
      'fonts.body': 'typography/fontFamily',
      'fonts.mono': 'typography/fontFamily',
      'typography.fontFamily': 'typography/fontFamily',
      'typography.fontSize.sm': 'typography/dimension',
      'typography.fontWeight.bold': 'typography/fontWeight',
      'typography.lineHeight.tight': 'typography/number',
      'typography.letterSpacing.wide': 'typography/dimension',
      'motion.fast': 'motion/duration',
      'motion.slow': 'motion/duration',
      'motion.ease': 'motion/cubicBezier',
      'motion.step': 'motion/cubicBezier',
      'space.0': 'other/number',
      'space.1': 'spacing/dimension',
      'space.2': 'spacing/dimension',
      'space.3': 'spacing/dimension',
      'radii.md': 'radius/dimension',
      'breakpoints.md': 'breakpoints/dimension',
      'zIndex.modal': 'other/number',
      'misc.label': 'other',
      'deep.a.b.c.d.e.f.g': 'spacing/dimension',
    }),
  )

  await check('the object adapter reads the light half as the value of a light-dark() token', () =>
    same(objectThemeTokens({ ink: 'light-dark(#111, #eee)' }).tokens, [
      {
        name: 'ink',
        group: 'colors',
        type: 'color',
        value: '#111',
        modes: { light: '#111', dark: '#eee' },
        origin: 'project',
        source: 'theme',
      },
    ]),
  )

  await check(
    'the object adapter makes one typography token of a style object, with px for a numeric size and letter spacing, and reads its other keys',
    () =>
      same(
        objectThemeTokens({
          typography: {
            title: {
              fontFamily: 'Inter, sans-serif',
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: -0.5,
              textTransform: 'uppercase',
              color: '#111',
            },
            caption: { fontSize: '12px' },
          },
        }).tokens,
        [
          {
            name: 'typography.title',
            group: 'typography',
            type: 'typography',
            value: '32px',
            origin: 'project',
            source: 'theme',
            parts: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '32px',
              fontWeight: '600',
              lineHeight: '1.25',
              letterSpacing: '-0.5px',
              textTransform: 'uppercase',
            },
          },
          {
            name: 'typography.title.color',
            group: 'colors',
            type: 'color',
            value: '#111',
            origin: 'project',
            source: 'theme',
          },
          {
            name: 'typography.caption.fontSize',
            group: 'typography',
            type: 'dimension',
            value: '12px',
            origin: 'project',
            source: 'theme',
          },
        ],
      ),
  )

  await check(
    'the object adapter reads a base style and the styles nested in it, but no scale of sizes',
    () =>
      same(
        objectThemeTokens({
          typography: {
            fontFamily: 'Lora',
            fontSize: 14,
            h1: { fontSize: '2rem', fontWeight: 300 },
          },
          text: { fontSize: { sm: '14px' }, lineHeight: 1.5 },
        }).tokens.map((token) => [token.name, token.type]),
        [
          ['typography', 'typography'],
          ['typography.h1', 'typography'],
          ['text.fontSize.sm', 'dimension'],
          ['text.lineHeight', 'number'],
        ],
      ),
  )

  await check('the object adapter reads a weight or a line height written as a string', () =>
    same(
      classified(
        objectThemeTokens({
          fontWeights: { regular: '400', bold: 'bold' },
          lineHeights: { tight: '1.25' },
          zIndex: { modal: '1300' },
          labels: { bold: 'bold' },
        }).tokens,
      ),
      {
        'fontWeights.regular': 'typography/fontWeight',
        'fontWeights.bold': 'typography/fontWeight',
        'lineHeights.tight': 'typography/number',
        'zIndex.modal': 'other/number',
        'labels.bold': 'other',
      },
    ),
  )

  await check('the object adapter reads a shared object at every path', () =>
    same(
      objectThemeTokens({ primary: shared, accent: shared }).tokens.map((token) => token.name),
      ['primary.main', 'accent.main'],
    ),
  )

  await check('the object adapter stops at 2000 tokens', () => {
    const { tokens, truncated } = objectThemeTokens({
      scale: Array.from({ length: 2001 }, (_, i) => `${i}px`),
    })

    return { passed: tokens.length === 2000 && truncated, detail: `${tokens.length}, ${truncated}` }
  })

  await check('manifestDiagnostics of an empty manifest has no foundations errors', () =>
    same(manifestDiagnostics({ modules: [], components: {} }).foundationsErrors, []),
  )

  await check('manifestDiagnostics returns the manifest’s foundations errors', () =>
    same(
      manifestDiagnostics({
        modules: [],
        components: {},
        foundations: { systems: [], tokens: 0, errors: ['foundations: x'] },
      }).foundationsErrors,
      ['foundations: x'],
    ),
  )
}

// ---------- Material UI's defaults ----------

/** The real `@mui/material/styles` of examples/mui. */
function muiStyles() {
  return createRequire(join(EXAMPLES, 'mui', 'package.json'))(MUI_STYLES)
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

/**
 * The theme that examples/mui/src/theme.ts exports, imported through Vitest's
 * module runner as the reporter imports it, with `MUI_CLASSIC` at `value`.
 */
async function exampleTheme(value) {
  const mui = join(EXAMPLES, 'mui')
  const vitestNode = createRequire(join(mui, 'package.json')).resolve('vitest/node')
  const { createVitest } = await import(pathToFileURL(vitestNode).href)
  const inherited = process.env.MUI_CLASSIC

  // Without the example's config nothing defines the variable, so theme.ts reads it from the process.
  process.env.MUI_CLASSIC = value

  const vitest = await createVitest('test', { config: false, root: mui, watch: false })

  try {
    const { theme } = await vitest.getRootProject().import(join(mui, 'src/theme.ts'))

    return theme
  } finally {
    await vitest.close()
    restoreEnv('MUI_CLASSIC', inherited)
  }
}

async function checkMuiDefaultOptions() {
  const { createTheme } = muiStyles()

  await check(
    'muiDefaultOptions of the theme in examples/mui/src/theme.ts is its light and dark schemes, defaultColorScheme light and cssVariables with prefix mui, selector media and root :root',
    async () =>
      same(muiDefaultOptions(await exampleTheme('')), {
        ...MUI_EXAMPLE_OPTIONS,
        cssVariables: { cssVarPrefix: 'mui', colorSchemeSelector: 'media', rootSelector: ':root' },
      }),
  )

  await check(
    'muiDefaultOptions of the same theme with MUI_CLASSIC=1 is its light and dark schemes and defaultColorScheme light, without cssVariables',
    async () => same(muiDefaultOptions(await exampleTheme('1')), MUI_EXAMPLE_OPTIONS),
  )

  await check(
    "muiDefaultOptions of createTheme({ palette: { mode: 'dark' } }) is { palette: { mode: 'dark' } }",
    () =>
      same(muiDefaultOptions(createTheme({ palette: { mode: 'dark' } })), {
        palette: { mode: 'dark' },
      }),
  )

  await check(
    'muiDefaultOptions leaves out a third color scheme, and createTheme() of the result does not throw',
    () => {
      // A partial palette makes createTheme() itself throw here.
      const contrast = { palette: { ...createTheme().palette, mode: 'light' } }
      const options = muiDefaultOptions(
        createTheme({ cssVariables: true, colorSchemes: { light: true, dark: true, contrast } }),
      )

      createTheme(options)

      return same(options.colorSchemes, { light: true, dark: true })
    },
  )
}

// ---------- collectFoundations on temp roots ----------

/**
 * A project with a recorded token sheet, written as the reporter keeps it:
 * one snapshot, whose style names `src/tokens.css`.
 */
function projectRoot(files = {}) {
  const root = tempDir()
  const snapshot = snapshotWith([
    { _cssText: ':root { --brand: #5b4bdb; }', 'data-vite-dev-id': 'src/tokens.css' },
  ])

  writeFiles(root, {
    'package.json': { name: 'app', private: true },
    'src/tokens.css': ':root { --brand: #5b4bdb; }',
    '.describe-me/snapshots/a.json': snapshot,
    ...files,
  })

  return root
}

async function collect(root, option, importModule) {
  return collectFoundations({
    root,
    snapshotFiles: ['snapshots/a.json'],
    option,
    importModule,
    paths: new ProjectPaths(root),
    sheets: new RecordedSheets(join(root, '.describe-me')),
    tailwindModules: new Map(),
  })
}

/** One sentence that names neither spelling of the root, and the token sheet still collected. */
function oneSentence(root, collected, expected) {
  const { foundations, summary } = collected
  const spellings = [root, realpathSync(root)]
  const [error] = foundations.errors

  return {
    passed:
      foundations.errors.length === 1 &&
      error.startsWith(expected) &&
      !spellings.some((spelling) => error.includes(spelling)) &&
      isDeepStrictEqual(summary.errors, foundations.errors) &&
      foundations.tokenSheets.length === 1 &&
      foundations.tokenSheets[0].source === 'src/tokens.css' &&
      summary.tokens >= 1,
    detail: JSON.stringify(foundations.errors),
  }
}

/** `{ theme }` for the theme file, and `styles()` for Material UI's styles, the real ones by default. */
function muiImport(theme, styles = muiStyles) {
  return async (id) => (id === MUI_STYLES ? styles() : { theme })
}

/** Every token of the theme stays `project`, and the adapter stays `mui`. */
function allProject(foundations) {
  return (
    foundations.theme?.adapter === 'mui' &&
    foundations.tokens.length > 0 &&
    foundations.tokens.every((token) => token.origin === 'project' && !token.modeOrigins)
  )
}

/** Material UI's defaults on a theme whose dark primary is the default, then the three failures. */
async function checkMuiCollected(themeOption) {
  const theme = muiStyles().createTheme({
    colorSchemes: { light: { palette: { primary: { main: '#5b4bdb' } } }, dark: true },
  })

  const files = { 'src/theme.ts': 'export const theme = {}' }

  await check(
    'collectFoundations: a theme with only a light primary gives palette.primary.main a default dark mode',
    async () => {
      const { foundations } = await collect(projectRoot(files), themeOption, muiImport(theme))
      const primary = tokenNamed(foundations, 'palette.primary.main')
      const error = tokenNamed(foundations, 'palette.error.main')

      return same(
        {
          primary: [primary?.origin, primary?.modes, primary?.modeOrigins],
          error: [error?.origin, 'modeOrigins' in (error ?? {})],
          errors: foundations.errors,
        },
        {
          primary: [
            'project',
            { light: '#5b4bdb', dark: '#90caf9' },
            { light: 'project', dark: 'default' },
          ],
          error: ['default', false],
          errors: [],
        },
      )
    },
  )

  await check(
    'collectFoundations: a throwing import of @mui/material/styles is one sentence without the temp root, and every token stays project',
    async () => {
      const root = projectRoot(files)
      const throwing = () => {
        throw new Error(
          `Cannot find package '@mui/material' imported from ${join(root, 'src/theme.ts')}\n    at ${root}/x.js:1:1`,
        )
      }

      const collected = await collect(root, themeOption, muiImport(theme, throwing))
      const outcome = oneSentence(
        root,
        collected,
        "foundations.theme: importing @mui/material/styles for Material UI's defaults failed: Cannot find package '@mui/material' imported from src/theme.ts",
      )

      return {
        passed: outcome.passed && allProject(collected.foundations),
        detail: `${outcome.detail}, ${JSON.stringify(collected.foundations.theme)}`,
      }
    },
  )

  await check(
    'collectFoundations: @mui/material/styles without createTheme is exactly the sentence that says so',
    async () => {
      const { foundations } = await collect(
        projectRoot(files),
        themeOption,
        muiImport(theme, () => ({})),
      )

      return {
        passed:
          isDeepStrictEqual(foundations.errors, [
            'foundations.theme: @mui/material/styles has no createTheme, so no Material UI token is marked default',
          ]) && allProject(foundations),
        detail: JSON.stringify(foundations.errors),
      }
    },
  )

  await check(
    'collectFoundations: a throwing createTheme() is one sentence without the temp root',
    async () => {
      const root = projectRoot(files)
      const file = join(realpathSync(root), 'src/theme.ts')
      const styles = () => ({
        createTheme: () => {
          throw new Error(`palette failed in ${file}`)
        },
      })

      const collected = await collect(root, themeOption, muiImport(theme, styles))
      const outcome = oneSentence(
        root,
        collected,
        "foundations.theme: createTheme() of @mui/material/styles failed for Material UI's defaults: palette failed in src/theme.ts",
      )

      return {
        passed: outcome.passed && allProject(collected.foundations),
        detail: outcome.detail,
      }
    },
  )
}

async function checkCollector() {
  const themeOption = { enabled: true, theme: { file: 'src/theme.ts' } }
  const unreachable = () => {
    throw new Error('imported a file that does not exist')
  }

  await check('collectFoundations: a missing theme file is one sentence', async () => {
    const root = projectRoot()

    return oneSentence(
      root,
      await collect(root, themeOption, unreachable),
      'foundations.theme: src/theme.ts does not exist',
    )
  })

  await check('collectFoundations: a module without theme or default is one sentence', async () => {
    const root = projectRoot({ 'src/theme.ts': 'export const other = {}' })

    return oneSentence(
      root,
      await collect(root, themeOption, async () => ({ other: {} })),
      'foundations.theme: src/theme.ts has no export named theme or default',
    )
  })

  await check('collectFoundations: a missing #export is one sentence', async () => {
    const root = projectRoot({ 'src/theme.ts': 'export const theme = {}' })
    const option = { enabled: true, theme: { file: 'src/theme.ts', exportName: 'tokens' } }

    return oneSentence(
      root,
      await collect(root, option, async () => ({ theme: {} })),
      'foundations.theme: src/theme.ts has no export named tokens',
    )
  })

  await check('collectFoundations: an export that is not an object is one sentence', async () => {
    const root = projectRoot({ 'src/theme.ts': "export const theme = 'x'" })

    return oneSentence(
      root,
      await collect(root, themeOption, async () => ({ theme: 'x' })),
      'foundations.theme: the export theme of src/theme.ts is not an object',
    )
  })

  await check(
    'collectFoundations: a throwing import is one sentence without the temp root',
    async () => {
      const root = projectRoot({ 'src/theme.ts': 'export const theme = {}' })
      const file = join(realpathSync(root), 'src/theme.ts')
      const throwing = async () => {
        throw new Error(
          `Failed to load url ${file} (resolved id: ${file}). Does the file exist?\n    at ${root}/x.js:1:1`,
        )
      }

      return oneSentence(
        root,
        await collect(root, themeOption, throwing),
        'foundations.theme: importing src/theme.ts failed: Failed to load url src/theme.ts',
      )
    },
  )

  await check(
    'collectFoundations: Tailwind 4 without @tailwindcss/node is one sentence',
    async () => {
      const root = projectRoot({
        'package.json': { name: 'app', private: true, devDependencies: { tailwindcss: '^4.0.0' } },
        'node_modules/tailwindcss/package.json': { name: 'tailwindcss', version: '4.0.0' },
        'src/tokens.css': "@import 'tailwindcss';\n:root { --brand: #5b4bdb; }",
      })

      const collected = await collect(root, { enabled: true }, undefined)
      const outcome = oneSentence(
        root,
        collected,
        'foundations: Tailwind 4 is installed, but @tailwindcss/node does not resolve from the root, so only the recorded CSS variables are read',
      )

      const { foundations } = collected

      return {
        passed:
          outcome.passed &&
          isDeepStrictEqual(foundations.systems, [
            { id: 'tailwind', package: 'tailwindcss', version: '4.0.0' },
          ]) &&
          isDeepStrictEqual(foundations.tailwind, { entry: 'src/tokens.css' }),
        detail: `${outcome.detail}, ${JSON.stringify(foundations.systems)}, ${JSON.stringify(foundations.tailwind)}`,
      }
    },
  )

  await check('collectFoundations: a Tailwind 3 entry is named and read no further', async () => {
    const root = projectRoot({
      'package.json': { name: 'app', private: true, devDependencies: { tailwindcss: '^3.4.0' } },
      'node_modules/tailwindcss/package.json': { name: 'tailwindcss', version: '3.4.0' },
      'src/tokens.css': '@import "tailwindcss/preflight" layer(base);\n:root { --brand: #5b4bdb; }',
    })

    const { foundations } = await collect(root, { enabled: true }, undefined)

    return same(
      { errors: foundations.errors, tailwind: foundations.tailwind, tokens: foundations.tokens },
      { errors: [], tailwind: { entry: 'src/tokens.css' }, tokens: [] },
    )
  })

  await check('collectFoundations: package.json and components.json name the systems', async () => {
    const root = projectRoot({
      'package.json': {
        name: 'app',
        dependencies: { antd: '^5', '@mui/material': '^9', 'styled-components': '^6' },
        peerDependencies: { '@emotion/react': '^11' },
        devDependencies: { tailwindcss: '^4' },
      },
      'node_modules/antd/package.json': { name: 'antd', version: '5.1.0' },
      'components.json': { style: 'new-york', tailwind: { baseColor: 'zinc', css: 'src/app.css' } },
    })

    const { foundations, summary } = await collect(root, { enabled: true }, undefined)

    return same(
      { systems: foundations.systems, shadcn: foundations.shadcn, ids: summary.systems },
      {
        systems: [
          { id: 'tailwind', package: 'tailwindcss' },
          { id: 'shadcn' },
          { id: 'mui', package: '@mui/material' },
          { id: 'styled-components', package: 'styled-components' },
          { id: 'emotion', package: '@emotion/react' },
          { id: 'antd', package: 'antd', version: '5.1.0' },
        ],
        shadcn: { style: 'new-york', baseColor: 'zinc', css: 'src/app.css' },
        ids: ['tailwind', 'shadcn', 'mui', 'styled-components', 'emotion', 'antd'],
      },
    )
  })

  await check('collectFoundations: a theme object counts its tokens with the sheets', async () => {
    const root = projectRoot({ 'src/theme.ts': 'export default {}' })
    const theme = { colors: { brand: '#5b4bdb', ink: 'light-dark(#111, #eee)' } }
    const { foundations, summary } = await collect(root, themeOption, async () => ({
      default: theme,
    }))

    return same(
      { theme: foundations.theme, names: foundations.tokens.map((token) => token.name), summary },
      {
        theme: { module: 'src/theme.ts', export: 'default', adapter: 'object' },
        names: ['colors.brand', 'colors.ink'],
        summary: { systems: [], tokens: 3 },
      },
    )
  })

  await checkMuiCollected(themeOption)
}

// ---------- the reporter ----------

/** Runs the reporter over an empty run, as `check-styled-components` does, and returns what it wrote. */
async function reporterRun(root, options) {
  const warned = []
  const { warn, info } = console
  console.warn = (...args) => warned.push(args.join(' '))
  console.info = () => {}

  try {
    const reporter = new DescribeMeReporter({ outDir: '.describe-me', ...options })
    reporter.onInit({ config: { root } })
    reporter.onTestRunStart()
    await reporter.onTestRunEnd()
  } finally {
    console.warn = warn
    console.info = info
  }

  const outDir = join(root, '.describe-me')
  const foundationsFile = join(outDir, 'foundations.json')

  return {
    manifest: readJson(join(outDir, 'manifest.json')),
    foundations: existsSync(foundationsFile) ? readJson(foundationsFile) : undefined,
    foundationsFile,
    manifestFile: join(outDir, 'manifest.json'),
    warned,
  }
}

async function checkReporter() {
  const stale = { '.describe-me/foundations.json': { version: 1, stale: true } }

  await check('the reporter with foundations: false removes a stale foundations.json', async () => {
    const { manifest, foundationsFile } = await reporterRun(projectRoot(stale), {
      foundations: false,
    })

    return same(
      { field: 'foundations' in manifest, file: existsSync(foundationsFile) },
      {
        field: false,
        file: false,
      },
    )
  })

  await check(
    'a run without tokens and problems writes neither the file nor the field, and removes a stale one',
    async () => {
      const root = tempDir()
      writeFiles(root, { 'package.json': { name: 'app' }, ...stale })
      const { manifest, foundationsFile } = await reporterRun(root, {})

      return same(
        { field: 'foundations' in manifest, file: existsSync(foundationsFile) },
        {
          field: false,
          file: false,
        },
      )
    },
  )

  await check(
    'a run with Material UI and no token writes a fresh foundations.json and { systems: [mui], tokens: 0 }',
    async () => {
      const root = tempDir()
      writeFiles(root, {
        'package.json': { name: 'app', dependencies: { '@mui/material': '^9' } },
        ...stale,
      })

      const { manifest, foundations } = await reporterRun(root, {})

      return same(
        {
          summary: manifest.foundations,
          stale: 'stale' in (foundations ?? { stale: true }),
          tokens: foundations?.tokens,
        },
        { summary: { systems: ['mui'], tokens: 0 }, stale: false, tokens: [] },
      )
    },
  )

  await check(
    'a theme without Vitest’s module runner gives one sentence in the file, the manifest and the terminal',
    async () => {
      const root = projectRoot({ 'src/theme.ts': 'export const theme = {}' })
      const run = await reporterRun(root, { foundations: { theme: 'src/theme.ts' } })
      const sentence =
        'foundations.theme: this Vitest cannot import project modules from a reporter'

      return {
        passed:
          isDeepStrictEqual(run.foundations?.errors, [sentence]) &&
          isDeepStrictEqual(run.manifest.foundations, {
            systems: [],
            tokens: 0,
            errors: [sentence],
          }) &&
          run.warned.filter((line) => line === `describe-me: ${sentence}`).length === 1 &&
          statSync(run.foundationsFile).mtimeMs <= statSync(run.manifestFile).mtimeMs,
        detail: JSON.stringify({ manifest: run.manifest.foundations, warned: run.warned }),
      }
    },
  )
}

// ---------- the examples ----------

/** Runs examples/mui with `name=value`, without the other switch, which does not combine with it. */
function runMui(name, value, other) {
  const env = { ...process.env, [name]: value }
  delete env[other]

  const result = spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    cwd: join(EXAMPLES, 'mui'),
    env,
    encoding: 'utf8',
  })

  return check(`examples/mui with ${name}=${value} passes`, () => ({
    passed: result.status === 0,
    detail: `exit ${result.status}\n${result.stdout}\n${result.stderr}`,
  }))
}

function runClassic() {
  return runMui('MUI_CLASSIC', '1', 'MUI_THEME')
}

function runWithoutTheme() {
  return runMui('MUI_THEME', 'off', 'MUI_CLASSIC')
}

/** A sheet's CSS: its stored chunks joined in order, or the inline text. */
function sheetText(outDir, cssText) {
  const reference = STYLE_REFERENCE.exec(cssText)

  if (reference === null) {
    return cssText
  }

  return reference[1]
    .split('+')
    .map((hash) => readFileSync(join(outDir, 'styles', `${hash}.css`), 'utf8'))
    .join('')
}

function endOfString(css, start) {
  let i = start + 1

  while (i < css.length && css[i] !== css[start]) {
    i += css[i] === '\\' ? 2 : 1
  }

  return i + 1
}

/** Every block of a stylesheet: its prelude, the preludes around it and its declarations. */
function blocksOf(css) {
  const blocks = []
  const stack = []
  let start = 0
  let i = 0

  while (i < css.length) {
    const char = css[i]

    // Tailwind escapes quotes in class selectors, as in `.\[\&_svg\:not\(\[class\*\=\'size-\'\]\)\]`.
    if (char === '\\') {
      i += 2
      continue
    }

    if (char === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2)
      i = close === -1 ? css.length : close + 2
      continue
    }

    if (char === '"' || char === "'") {
      i = endOfString(css, i)
      continue
    }

    if (char === '{') {
      stack.push({ prelude: css.slice(start, i).trim(), declarations: [] })
      start = i + 1
    } else if (char === ';' || char === '}') {
      stack.at(-1)?.declarations.push(css.slice(start, i).trim())
      start = i + 1

      if (char === '}' && stack.length > 0) {
        const block = stack.pop()
        blocks.push({ ...block, parents: stack.map((parent) => parent.prelude) })
      }
    }

    i++
  }

  return blocks
}

/**
 * The values a sheet declares for `name` in a block with `selector`, under
 * the at-rules `within` (layers do not count).
 */
function declared(css, selector, within, name) {
  return blocksOf(css)
    .filter((block) => block.prelude.split(',').some((part) => part.trim() === selector))
    .filter((block) =>
      isDeepStrictEqual(
        block.parents.filter((parent) => !parent.startsWith('@layer')),
        within,
      ),
    )
    .flatMap((block) => block.declarations)
    .filter((declaration) => declaration.startsWith(`${name}:`))
    .map((declaration) => declaration.slice(name.length + 1).trim())
}

function tokenNamed(foundations, name) {
  return foundations.tokens.find((token) => token.name === name)
}

/** Reads every output, or fails once and returns null. */
async function readOutputs() {
  const outputs = {}

  for (const [label, dir] of Object.entries(OUTPUTS)) {
    const outDir = join(EXAMPLES, dir)

    try {
      outputs[label] = {
        outDir,
        foundations: readJson(join(outDir, 'foundations.json')),
        manifest: readJson(join(outDir, 'manifest.json')),
      }
    } catch (error) {
      await check(`${label}: foundations.json and manifest.json are readable`, () => ({
        passed: false,
        detail: `${errorMessage(error)}. Run the example's tests first.`,
      }))
    }
  }

  return outputs
}

async function checkShadcn({ outDir, foundations, manifest }) {
  const tailwindTokens = foundations.tokens.filter((token) => token.source === 'tailwind')
  const brand = tailwindTokens.filter((token) => token.name.startsWith('--color-brand-'))
  const defaults = tailwindTokens.filter((token) => token.origin === 'default')
  const [tailwind, shadcn] = foundations.systems

  await check('shadcn: systems tailwind 4.x and shadcn, components.json css src/index.css', () => ({
    passed:
      foundations.systems.length === 2 &&
      tailwind.id === 'tailwind' &&
      /^4\./.test(tailwind.version ?? '') &&
      isDeepStrictEqual(shadcn, { id: 'shadcn' }) &&
      foundations.shadcn?.css === 'src/index.css',
    detail: JSON.stringify({ systems: foundations.systems, shadcn: foundations.shadcn }),
  }))

  await check('shadcn: the Tailwind entry is src/index.css', () =>
    same(foundations.tailwind, { entry: 'src/index.css' }),
  )

  await check('shadcn: --color-brand-50 to -950 are 11 project colors', () =>
    same(
      brand.map((token) => [token.name, token.origin, token.group]),
      [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
        `--color-brand-${step}`,
        'project',
        'colors',
      ]),
    ),
  )

  await check('shadcn: at least 300 default tokens, --color-red-500 among them', () => ({
    passed:
      defaults.length >= 300 &&
      defaults.some((token) => token.name === '--color-red-500' && token.group === 'colors'),
    detail: `${defaults.length} default tokens`,
  }))

  await check('shadcn: no Tailwind token named --radius, a reference entry', () =>
    same(tokenNamed(foundations, '--radius'), undefined),
  )

  await check('shadcn: --text-xs has parts.lineHeight', () => ({
    passed: typeof tokenNamed(foundations, '--text-xs')?.parts?.lineHeight === 'string',
    detail: JSON.stringify(tokenNamed(foundations, '--text-xs')),
  }))

  await check('shadcn: --default-font-family is var(--font-sans)', () =>
    same(tokenNamed(foundations, '--default-font-family')?.value, 'var(--font-sans)'),
  )

  await check('shadcn: a src/index.css token sheet declares --primary in :root and .dark', () => {
    const sheet = foundations.tokenSheets.find((candidate) => candidate.source === 'src/index.css')
    const css = sheet === undefined ? '' : sheetText(outDir, sheet.cssText)
    const light = declared(css, ':root', [], '--primary')
    const dark = declared(css, '.dark', [], '--primary')

    return {
      passed: light.length === 1 && dark.length === 1,
      detail: JSON.stringify({ light, dark }),
    }
  })

  await check('shadcn: a font sheet with @font-face', () =>
    foundations.fontSheets.some((sheet) => /@font-face\b/.test(sheetText(outDir, sheet.cssText))),
  )

  await check('shadcn: no errors, and the manifest counts at least 470 tokens', () => ({
    passed: foundations.errors.length === 0 && manifest.foundations?.tokens >= 470,
    detail: JSON.stringify({ errors: foundations.errors, manifest: manifest.foundations }),
  }))
}

/** Material UI's defaults, which both outputs with the theme module share. */
async function checkMuiDefaults(label, foundations) {
  const origins = (origin) => foundations.tokens.filter((token) => token.origin === origin)

  await check(
    `${label}: ${MUI_DEFAULT_COUNT} tokens are default, and the ${MUI_PROJECT_TOKENS.length} project ones are those src/theme.ts sets`,
    () =>
      same(
        {
          defaults: origins('default').length,
          project: origins('project').map(({ name }) => name),
        },
        { defaults: MUI_DEFAULT_COUNT, project: MUI_PROJECT_TOKENS },
      ),
  )

  await check(
    `${label}: palette.primary.main is project, palette.error.main default with modes #d32f2f and #f44336`,
    () => {
      const error = tokenNamed(foundations, 'palette.error.main')

      return same(
        [tokenNamed(foundations, 'palette.primary.main')?.origin, error?.origin, error?.modes],
        ['project', 'default', { light: '#d32f2f', dark: '#f44336' }],
      )
    },
  )

  await check(`${label}: no token has modeOrigins`, () =>
    same(
      foundations.tokens.filter((token) => 'modeOrigins' in token).map(({ name }) => name),
      [],
    ),
  )
}

async function checkMuiClassic({ foundations }) {
  const variants = foundations.tokens.filter(
    (token) => token.name.startsWith('typography.') && token.type === 'typography',
  )

  const spacing = Array.from({ length: 13 }, (_, step) => `spacing(${step})`)
  const shadows = foundations.tokens.filter((token) => token.name.startsWith('shadows.'))

  await check(
    'mui, MUI_CLASSIC=1: the theme module is src/theme.ts, export theme, adapter mui',
    () => same(foundations.theme, { module: 'src/theme.ts', export: 'theme', adapter: 'mui' }),
  )

  await check('mui, MUI_CLASSIC=1: palette.primary.main has modes #5b4bdb and #a99cff', () =>
    same(tokenNamed(foundations, 'palette.primary.main')?.modes, {
      light: '#5b4bdb',
      dark: '#a99cff',
    }),
  )

  await check('mui, MUI_CLASSIC=1: 13 typography variants with parts', () => ({
    passed: variants.length === 13 && variants.every((token) => token.parts?.fontSize),
    detail: variants.map((token) => token.name).join(', '),
  }))

  await check('mui, MUI_CLASSIC=1: spacing(0) to spacing(12), spacing(1) is 8px', () => ({
    passed:
      spacing.every((name) => tokenNamed(foundations, name)?.group === 'spacing') &&
      tokenNamed(foundations, 'spacing(1)')?.value === '8px',
    detail: JSON.stringify(tokenNamed(foundations, 'spacing(1)')),
  }))

  await check('mui, MUI_CLASSIC=1: shape.borderRadius is 10px', () =>
    same(tokenNamed(foundations, 'shape.borderRadius')?.value, '10px'),
  )

  await check('mui, MUI_CLASSIC=1: 25 shadows', () => same(shadows.length, 25))

  await check(
    'mui, MUI_CLASSIC=1: 3 Roboto font sheets from node_modules/@fontsource/roboto/',
    () =>
      same(
        foundations.fontSheets.map((sheet) => sheet.source),
        ['400', '500', '700'].map((weight) => `node_modules/@fontsource/roboto/${weight}.css`),
      ),
  )

  await check('mui, MUI_CLASSIC=1: no project CSS sources, systems mui and emotion', () =>
    same(
      { cssSources: foundations.cssSources, systems: foundations.systems.map(({ id }) => id) },
      { cssSources: [], systems: ['mui', 'emotion'] },
    ),
  )

  await checkMuiDefaults('mui, MUI_CLASSIC=1', foundations)
}

async function checkMuiCssVariables({ outDir, foundations }) {
  await check(
    'mui: --mui-palette-primary-main is #5b4bdb in :root and #a99cff in the dark media query',
    () => {
      const sheets = foundations.tokenSheets.map((sheet) => sheetText(outDir, sheet.cssText))
      const name = '--mui-palette-primary-main'
      const light = sheets.flatMap((css) => declared(css, ':root', [], name))
      const dark = sheets.flatMap((css) => declared(css, ':root', [DARK_MEDIA], name))

      return same({ light, dark }, { light: ['#5b4bdb'], dark: ['#a99cff'] })
    },
  )

  await check('mui: spacing(1) is var(--mui-spacing, 8px)', () =>
    same(tokenNamed(foundations, 'spacing(1)')?.value, 'var(--mui-spacing, 8px)'),
  )

  await check('mui: no token name ends in Channel', () =>
    same(
      foundations.tokens.filter((token) => token.name.endsWith('Channel')).map(({ name }) => name),
      [],
    ),
  )

  await checkMuiDefaults('mui', foundations)

  await check('mui: spacing(1) is default', () =>
    same(tokenNamed(foundations, 'spacing(1)')?.origin, 'default'),
  )
}

async function checkMuiWithoutTheme({ foundations, manifest }) {
  const label = 'mui, MUI_THEME=off'

  await check(
    `${label}: systems mui and emotion, no theme, no tokens or token sheets, the 3 Roboto font sheets and no errors`,
    () =>
      same(
        {
          systems: foundations.systems.map(({ id }) => id),
          theme: 'theme' in foundations,
          tokens: foundations.tokens,
          tokenSheets: foundations.tokenSheets,
          fontSheets: foundations.fontSheets.map((sheet) => sheet.source),
          errors: foundations.errors,
        },
        {
          systems: ['mui', 'emotion'],
          theme: false,
          tokens: [],
          tokenSheets: [],
          fontSheets: ['400', '500', '700'].map(
            (weight) => `node_modules/@fontsource/roboto/${weight}.css`,
          ),
          errors: [],
        },
      ),
  )

  await check(`${label}: manifest.foundations is { systems: [mui, emotion], tokens: 0 }`, () =>
    same(manifest.foundations, { systems: ['mui', 'emotion'], tokens: 0 }),
  )
}

/** The light and dark halves of every `light-dark()` color in react-jsdom's src/theme.ts. */
function jsdomThemeColors() {
  const source = readFileSync(join(EXAMPLES, 'react-jsdom/src/theme.ts'), 'utf8')

  return Object.fromEntries(
    Array.from(source.matchAll(/^ +(\w+): '(light-dark\([^']*\))',$/gm), ([, key, value]) => [
      `colors.${key}`,
      splitLightDark(value),
    ]),
  )
}

/** Whether a token sheet with that source declares `--ink` on `:root` and in the dark media query. */
function declaresInk(outDir, foundations, source) {
  const sheet = foundations.tokenSheets.find((candidate) => candidate.source === source)
  const css = sheet === undefined ? '' : sheetText(outDir, sheet.cssText)
  const light = declared(css, ':root', [], '--ink')
  const dark = declared(css, ':root', [DARK_MEDIA], '--ink')

  return {
    passed: light.length === 1 && dark.length === 1,
    detail: JSON.stringify({ light, dark }),
  }
}

async function checkReactJsdom({ outDir, foundations, manifest }) {
  const expected = jsdomThemeColors()

  await check(
    'react-jsdom: colors.ink, paper and muted have the light-dark() halves of src/theme.ts',
    () =>
      same(
        Object.fromEntries(foundations.tokens.map((token) => [token.name, token.modes])),
        Object.keys(expected).length === 3 ? expected : 'three light-dark() colors in src/theme.ts',
      ),
  )

  await check('react-jsdom: a src/styles.css token sheet declares --ink in :root and in dark', () =>
    declaresInk(outDir, foundations, 'src/styles.css'),
  )

  await check('react-jsdom: the font sheet src/assets/fonts/fonts.css is inline CSS', () => {
    const sheet = foundations.fontSheets.find(
      (candidate) => candidate.source === 'src/assets/fonts/fonts.css',
    )

    return {
      passed: sheet !== undefined && sheet.cssText.startsWith('@font-face'),
      detail: JSON.stringify(sheet),
    }
  })

  await check('react-jsdom: systems styled-components, 10 tokens in the manifest', () =>
    same(manifest.foundations, { systems: ['styled-components'], tokens: 10 }),
  )
}

async function checkReactBrowser({ outDir, foundations, manifest }) {
  await check('react-browser: no systems, no theme and no tokens', () =>
    same(
      { systems: foundations.systems, theme: foundations.theme, tokens: foundations.tokens },
      { systems: [], theme: undefined, tokens: [] },
    ),
  )

  await check('react-browser: a src/styles.css token sheet declares --ink in both modes', () =>
    declaresInk(outDir, foundations, 'src/styles.css'),
  )

  await check('react-browser: manifest.foundations is { systems: [], tokens: 7 }', () =>
    same(manifest.foundations, { systems: [], tokens: 7 }),
  )
}

async function checkEveryOutput(label, { outDir, manifest }) {
  const file = join(outDir, 'foundations.json')
  const text = readFileSync(file, 'utf8')

  await check(`${label}: every chunk that foundations.json names exists`, () => {
    const hashes = Array.from(text.matchAll(STYLE_HASHES), (match) => match[1].split('+')).flat()
    const missing = hashes.filter((hash) => !existsSync(join(outDir, 'styles', `${hash}.css`)))

    return { passed: missing.length === 0, detail: `${missing.length} of ${hashes.length} missing` }
  })

  await check(
    `${label}: foundations.json names neither the checkout nor the home directory`,
    () => {
      const dir = tempDir()
      copyFileSync(file, join(dir, 'foundations.json'))
      const { problems } = machinePathsIn(dir, { 'the checkout': REPO })

      return { passed: problems.length === 0, detail: problems.join(', ') }
    },
  )

  await check(`${label}: the manifest has foundations and no foundations errors`, () => ({
    passed: manifest.foundations !== undefined && manifest.foundations.errors === undefined,
    detail: JSON.stringify(manifest.foundations),
  }))
}

async function checkExamples() {
  await runClassic()
  await runWithoutTheme()

  const outputs = await readOutputs()
  const perOutput = {
    'react-browser': checkReactBrowser,
    'react-jsdom': checkReactJsdom,
    shadcn: checkShadcn,
    mui: checkMuiCssVariables,
    'mui, MUI_CLASSIC=1': checkMuiClassic,
    'mui, MUI_THEME=off': checkMuiWithoutTheme,
  }

  for (const [label, output] of Object.entries(outputs)) {
    await perOutput[label](output)
    await checkEveryOutput(label, output)
  }

  await checkView({ check, tempDir, outputs })

  console.log('\nCollecting time per output:')

  for (const [label, { foundations, manifest }] of Object.entries(outputs)) {
    const tokens = manifest.foundations?.tokens ?? 0
    console.log(`  ${label}: ${foundations.duration} ms, ${tokens} tokens in the manifest`)
  }
}

try {
  await checkOption()
  await checkRootCustomProperties()
  await checkSplitLightDark()
  await checkObjectAdapter()
  await checkMuiDefaultOptions()
  await checkCollector()
  await checkReporter()
  await checkExamples()
} finally {
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`check-foundations: ${failures} of ${checks} checks failed`)
  process.exit(1)
}

console.log(`check-foundations: all ${checks} checks passed`)
