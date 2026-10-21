import { LIVE_BASE } from './live-base.js'
import { LIVE_MODULE_IDS } from './live-module-ids.js'
import type { LivePageSettings } from './live-page-settings.js'
import { liveStringLiteral } from './live-string-literal.js'

/**
 * The `importTest` of the dev server's entry. It imports an absolute URL
 * under the server's base: Vite adds `?import` to a path from the root, and
 * the static self-import that `@vitejs/plugin-react` adds to a file with a
 * component would then load the test file a second time.
 */
const SERVE_IMPORT_TEST = [
  `  importTest: (file) => import(/* @vite-ignore */ new URL(${liveStringLiteral(LIVE_BASE)} + file, location.origin).href),`,
]

/** The `importTest` of a build, which holds only the test files of its map. */
const BUILD_IMPORT_TEST = [
  '  importTest: (file) =>',
  '    Object.hasOwn(testFiles, file)',
  '      ? testFiles[file]()',
  '      : Promise.reject(new Error(`${file} is not in this build`)),',
]

/**
 * The source of the live page's entry. On the dev server the `import()` of
 * the test file stays here, in a module of the project's server, so it loads
 * from the server. A build imports it from the map of lazy imports, so the
 * bundler sees every test file. Setup files are literal imports, so Vite
 * resolves them and a build bundles them.
 */
export function liveEntrySource(
  settings: Pick<LivePageSettings, 'globals' | 'testTimeout' | 'setupFiles' | 'vitestMajor'>,
  command: 'serve' | 'build',
): string {
  const setupFiles = settings.setupFiles.map(
    (setupFile) =>
      `    { file: ${liveStringLiteral(setupFile.name)}, load: () => import(${liveStringLiteral(setupFile.specifier)}) },`,
  )

  const testFilesImport =
    command === 'build'
      ? [`import testFiles from ${liveStringLiteral(LIVE_MODULE_IDS.testFiles)}`]
      : []

  return [
    `import { startLivePage } from '@describe-me/vitest/live-runtime'`,
    ...testFilesImport,
    '',
    'startLivePage({',
    ...(command === 'build' ? BUILD_IMPORT_TEST : SERVE_IMPORT_TEST),
    `  globals: ${String(settings.globals)},`,
    `  testTimeout: ${String(settings.testTimeout)},`,
    `  vitestMajor: ${String(settings.vitestMajor)},`,
    '  setupFiles: [',
    ...setupFiles,
    '  ],',
    '})',
    '',
  ].join('\n')
}
