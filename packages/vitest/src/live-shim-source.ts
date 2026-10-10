/**
 * The source of a module that the live page imports instead of `vitest`,
 * `vitest/browser` or `@describe-me/vitest`. It exports every name the real
 * module has, so a test that imports one still links.
 */
export function liveShimSource(module: string, names: string[]): string {
  const exports = names.map((name) => `export const ${name} = liveExport('${module}', '${name}')`)

  return [`import { liveExport } from '@describe-me/vitest/live-runtime'`, '', ...exports, ''].join(
    '\n',
  )
}
