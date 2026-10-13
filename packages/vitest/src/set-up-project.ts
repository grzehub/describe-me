import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'
import type { EnvironmentProfile } from './environment-profile.js'

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
 * Gives a project the profile's setup file, when it lacks it, and the
 * profile's variables. In Vitest 5 a project that shares the root's Vite
 * server inherits the root config as it was before the plugin's `config`
 * hook, so it gets the render redirect but not the setup file, and records
 * nothing. The file goes last, as in the root config. Only projects with the
 * setup file get the variables, so one without describe-me keeps Testing
 * Library's own cleanup.
 */
export function setUpProject(project: TestProject, profile: EnvironmentProfile): void {
  const file = resolveFrom(project.config.root, profile.setupFile)

  if (file === null) {
    return
  }

  const real = realPathOf(file)

  if (!project.config.setupFiles.some((entry) => realPathOf(entry) === real)) {
    project.config.setupFiles.push(file)
  }

  project.config.env = { ...project.config.env, ...profile.env }
}
