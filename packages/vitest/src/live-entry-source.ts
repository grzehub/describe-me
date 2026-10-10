/**
 * The source of the live page's entry. The `import()` of the test file stays
 * here, in a module of the project's dev server, so it loads from the server.
 * It imports an absolute URL: Vite adds `?import` to a path from the root,
 * and the static self-import that `@vitejs/plugin-react` adds to a file with
 * a component would then load the test file a second time.
 */
export function liveEntrySource(globals: boolean, testTimeout: number): string {
  return [
    `import { startLivePage } from '@describe-me/vitest/live-runtime'`,
    '',
    'startLivePage({',
    `  importTest: (file) => import(/* @vite-ignore */ new URL('/' + file, location.origin).href),`,
    `  globals: ${String(globals)},`,
    `  testTimeout: ${String(testTimeout)},`,
    '})',
    '',
  ].join('\n')
}
