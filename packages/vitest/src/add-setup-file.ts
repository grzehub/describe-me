import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'

function resolveFrom(root: string, specifier: string): string | null {
  try {
    return createRequire(join(root, 'package.json')).resolve(specifier)
  } catch {
    return null
  }
}

function realPathOf(file: string): string {
  try {
    return realpathSync(file)
  } catch {
    return file
  }
}

/**
 * Gives a project the setup file it lacks. In Vitest 5 a project that shares
 * the root's Vite server inherits the root config as it was before the
 * plugin's `config` hook, so it gets the render redirect and
 * `RTL_SKIP_AUTO_CLEANUP` but not the setup file: it records nothing and
 * leaves every test mounted. The file goes last, as in the root config.
 */
export function addSetupFile(project: TestProject, setupFile: string): void {
  const file = resolveFrom(project.config.root, setupFile)

  if (file === null) {
    return
  }

  const real = realPathOf(file)

  if (project.config.setupFiles.some((entry) => realPathOf(entry) === real)) {
    return
  }

  project.config.setupFiles.push(file)
}
