/**
 * The source of the live page's entry. The `import()` of the test file stays
 * here, in a module of the project's dev server, so it loads from the server.
 */
export function liveEntrySource(globals: boolean, testTimeout: number): string {
  return [
    `import { startLivePage } from '@describe-me/vitest/live-runtime'`,
    '',
    'startLivePage({',
    `  importTest: (file) => import(/* @vite-ignore */ '/' + file),`,
    `  globals: ${String(globals)},`,
    `  testTimeout: ${String(testTimeout)},`,
    '})',
    '',
  ].join('\n')
}
