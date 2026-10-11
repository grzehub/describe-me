import { liveStringLiteral } from './live-string-literal.js'

/**
 * The source of a build's map of test files: each path from the root to a
 * lazy import of the file, so the bundler gives every test file a chunk of
 * its own and the page loads only the one it shows.
 */
export function liveTestFilesSource(testFiles: string[]): string {
  const entries = testFiles.map(
    (file) => `  ${liveStringLiteral(file)}: () => import(${liveStringLiteral(`/${file}`)}),`,
  )

  return ['export default {', ...entries, '}', ''].join('\n')
}
