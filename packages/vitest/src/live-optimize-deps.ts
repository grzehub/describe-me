import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

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

/**
 * Vite's `optimizeDeps` for the live page. Vite bundles every dependency
 * before the first page loads, so it never finds one late and reloads the
 * page. Its scanner starts from the test files of the manifest, from none
 * without a manifest, and the page's own imports are listed outright.
 */
export function liveOptimizeDeps(
  root: string,
  outDir: string | undefined,
  live: string,
): { entries: string[]; include: string[] } {
  const projectRequire = createRequire(join(root, 'package.json'))

  return {
    entries: testFiles(root, outDir ?? '.describe-me'),
    include: pageDependencies(live).filter((specifier) => resolvable(projectRequire, specifier)),
  }
}
