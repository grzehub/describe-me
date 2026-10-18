import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Foundations, FoundationToken } from '@describe-me/core/types'
import { firstLineOf } from './first-line-of.js'
import { markMuiDefaults } from './mark-mui-defaults.js'
import { muiThemeTokens } from './mui-theme-tokens.js'
import { objectThemeTokens } from './object-theme-tokens.js'
import type { ProjectPaths } from './project-paths.js'
import type { FoundationsOption } from './validate-foundations.js'

/**
 * Imports a module the way Vitest runs it, from an absolute path or a package
 * id that resolves from the root.
 */
export type ImportModule = (file: string) => Promise<unknown>

/** What the theme module gave: its description and tokens, or the one sentence that says why not. */
export interface ImportedTheme {
  theme?: NonNullable<Foundations['theme']>
  tokens: FoundationToken[]
  errors: string[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** `spacing()`, a palette, typography, breakpoint values and a list of shadows, as `createTheme()` returns them. */
function isMuiTheme(value: Record<string, unknown>): boolean {
  const breakpoints = value.breakpoints

  return (
    typeof value.spacing === 'function' &&
    isObject(value.palette) &&
    isObject(value.typography) &&
    isObject(breakpoints) &&
    isObject(breakpoints.values) &&
    Array.isArray(value.shadows)
  )
}

/** The export to read and its name, or the sentence that says it is missing. */
function pickExport(
  namespace: Record<string, unknown>,
  exportName: string | undefined,
  module: string,
): { name: string; value: unknown } | { error: string } {
  if (exportName !== undefined) {
    return namespace[exportName] === undefined
      ? { error: `foundations.theme: ${module} has no export named ${exportName}` }
      : { name: exportName, value: namespace[exportName] }
  }

  for (const name of ['theme', 'default']) {
    if (namespace[name] !== undefined) {
      return { name, value: namespace[name] }
    }
  }

  return { error: `foundations.theme: ${module} has no export named theme or default` }
}

/**
 * Reads the tokens of the theme module that `foundations.theme` names: a
 * Material UI theme or a plain object. Every problem becomes one sentence.
 */
export async function importTheme(
  option: NonNullable<FoundationsOption['theme']>,
  root: string,
  importModule: ImportModule | undefined,
  paths: ProjectPaths,
): Promise<ImportedTheme> {
  const file = resolve(root, option.file)
  const module = paths.of(file) ?? paths.fromRoot(file)
  const failed = (error: string): ImportedTheme => ({ tokens: [], errors: [error] })

  // Checked first: the import's own error names the file by its absolute path, twice.
  if (!existsSync(file)) {
    return failed(`foundations.theme: ${module} does not exist`)
  }

  if (importModule === undefined) {
    return failed('foundations.theme: this Vitest cannot import project modules from a reporter')
  }

  let namespace: unknown

  try {
    namespace = await importModule(file)
  } catch (error) {
    return failed(`foundations.theme: importing ${module} failed: ${firstLineOf(error)}`)
  }

  const picked = pickExport(isObject(namespace) ? namespace : {}, option.exportName, module)

  if ('error' in picked) {
    return failed(picked.error)
  }

  if (!isObject(picked.value)) {
    return failed(`foundations.theme: the export ${picked.name} of ${module} is not an object`)
  }

  const theme = { module, export: picked.name }

  if (isMuiTheme(picked.value)) {
    const marked = await markMuiDefaults(picked.value, muiThemeTokens(picked.value), importModule)

    return { theme: { ...theme, adapter: 'mui' }, ...marked }
  }

  const { tokens, truncated } = objectThemeTokens(picked.value)
  const errors = truncated
    ? [`foundations.theme: ${module} has more than 2000 tokens, so only the first 2000 are read`]
    : []

  return { theme: { ...theme, adapter: 'object' }, tokens, errors }
}
