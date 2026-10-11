import type { LivePageSettings } from './live-page-settings.js'

// JSON.stringify leaves these as they are. Escaped, a file name cannot close a
// script tag that inlines the entry, nor end a line for an older parser.
const UNSAFE_IN_CODE = /[<>\u2028\u2029]/g

/** A string literal for generated code. */
function stringLiteral(value: string): string {
  return JSON.stringify(value).replace(
    UNSAFE_IN_CODE,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

/**
 * The source of the live page's entry. The `import()` of the test file stays
 * here, in a module of the project's dev server, so it loads from the server.
 * It imports an absolute URL: Vite adds `?import` to a path from the root,
 * and the static self-import that `@vitejs/plugin-react` adds to a file with
 * a component would then load the test file a second time. Setup files are
 * literal imports, so Vite resolves them and a static build can bundle them.
 */
export function liveEntrySource(
  settings: Pick<LivePageSettings, 'globals' | 'testTimeout' | 'setupFiles' | 'vitestMajor'>,
): string {
  const setupFiles = settings.setupFiles.map(
    (setupFile) =>
      `    { file: ${stringLiteral(setupFile.name)}, load: () => import(${stringLiteral(setupFile.specifier)}) },`,
  )

  return [
    `import { startLivePage } from '@describe-me/vitest/live-runtime'`,
    '',
    'startLivePage({',
    `  importTest: (file) => import(/* @vite-ignore */ new URL('/' + file, location.origin).href),`,
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
