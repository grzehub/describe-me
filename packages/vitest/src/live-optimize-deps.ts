import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, sep } from 'node:path'
import type { LiveSetupFile } from './live-setup-files.js'

/**
 * Modules the optimizer must leave to the shims. A package that imports
 * `vitest`, such as `@testing-library/jest-dom/vitest`, would otherwise carry
 * the real Vitest in its bundle. `vitest` covers `vitest/browser` too.
 */
const SHIMMED = ['vitest', '@vitest/browser/context']

/** What the live page imports that no test file does, so Vite's scanner cannot find it. */
function pageDependencies(live: string): string[] {
  return [
    '@describe-me/vitest/live-runtime',
    live,
    'react',
    'react-dom/client',
    'react/jsx-dev-runtime',
    '@testing-library/react',
  ]
}

function resolvable(projectRequire: NodeJS.Require, specifier: string): boolean {
  try {
    projectRequire.resolve(specifier)

    return true
  } catch {
    return false
  }
}

/** The test files of the plugin's own manifest, with the `/` separators that Vite's globs expect. */
function testFiles(root: string, outDir: string): string[] {
  try {
    const manifest = JSON.parse(readFileSync(join(root, outDir, 'manifest.json'), 'utf8')) as {
      modules?: { id?: unknown }[]
    }

    return (manifest.modules ?? [])
      .map((module) => module.id)
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.replaceAll('\\', '/'))
  } catch {
    return []
  }
}

/** The setup files that are paths, relative to the root, like the test files. */
function setupFileEntries(root: string, setupFiles: LiveSetupFile[]): string[] {
  return setupFiles
    .map((setupFile) => setupFile.file)
    .filter((file): file is string => file !== undefined)
    .map((file) => relative(root, file).split(sep).join('/'))
}

/**
 * Vite's `optimizeDeps` for the live page. Vite bundles every dependency
 * before the first page loads, so it never finds one late and reloads the
 * page. Its scanner starts from the test files of the manifest and the setup
 * files, and the page's own imports and the package setup files are listed
 * outright.
 */
export function liveOptimizeDeps(
  root: string,
  outDir: string | undefined,
  live: string,
  setupFiles: LiveSetupFile[] = [],
): { entries: string[]; include: string[]; exclude: string[] } {
  const projectRequire = createRequire(join(root, 'package.json'))
  const packages = setupFiles
    .filter((setupFile) => setupFile.file === undefined)
    .map((setupFile) => setupFile.specifier)

  return {
    entries: [...testFiles(root, outDir ?? '.describe-me'), ...setupFileEntries(root, setupFiles)],
    include: [...pageDependencies(live), ...packages].filter((specifier) =>
      resolvable(projectRequire, specifier),
    ),
    exclude: [...SHIMMED],
  }
}
