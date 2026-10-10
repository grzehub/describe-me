import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Vite } from 'vitest/node'

/** The `package.json` of the project's Vite, or of the Vite its Vitest runs on. */
function vitePackageJson(root: string): string {
  const projectRequire = createRequire(join(root, 'package.json'))

  try {
    return projectRequire.resolve('vite/package.json')
  } catch {
    // Not a direct dependency of the project. Vitest's own Vite runs the tests.
  }

  try {
    const vitest = projectRequire.resolve('vitest/package.json')

    return createRequire(vitest).resolve('vite/package.json')
  } catch {
    throw new Error(`describe-me: cannot find vite from ${root}`)
  }
}

/** The ES module entry of `exports['.']`: its `import` condition, or the string itself. */
function esmEntry(target: unknown): string | null {
  if (typeof target === 'string') {
    return target
  }

  if (typeof target !== 'object' || target === null) {
    return null
  }

  const conditions = target as Record<string, unknown>

  return esmEntry(conditions.import ?? conditions.default)
}

/**
 * The project's own Vite, so its plugins run on the version they were made
 * for. Always the ES module build: `require.resolve('vite')` can pick the
 * CommonJS one of older majors.
 */
export async function importLiveVite(root: string): Promise<typeof Vite> {
  const packageJson = vitePackageJson(root)
  const { exports } = JSON.parse(readFileSync(packageJson, 'utf8')) as {
    exports?: Record<string, unknown>
  }

  const entry = esmEntry(exports?.['.'])

  if (entry === null) {
    throw new Error(`describe-me: cannot find the ES module entry of vite in ${packageJson}`)
  }

  return (await import(pathToFileURL(join(dirname(packageJson), entry)).href)) as typeof Vite
}
