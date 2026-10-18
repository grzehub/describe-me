import { inspect } from 'node:util'

/** The `foundations` option of `describeMe()` and of the reporter, checked. */
export interface FoundationsOption {
  enabled: boolean
  /** The theme module, relative to the root, and the export named after its `#`. */
  theme?: { file: string; exportName?: string }
}

const EXPORT_NAME = /^[A-Za-z_$][\w$]*$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function themeError(value: unknown): Error {
  return new Error(
    `describe-me: foundations.theme must be a module path, optionally with #exportName, got ${inspect(value)}`,
  )
}

function parseTheme(value: unknown): FoundationsOption['theme'] {
  if (typeof value !== 'string' || value === '') {
    throw themeError(value)
  }

  const hashAt = value.lastIndexOf('#')

  if (hashAt === -1) {
    return { file: value }
  }

  const file = value.slice(0, hashAt)
  const exportName = value.slice(hashAt + 1)

  if (file === '' || !EXPORT_NAME.test(exportName)) {
    throw themeError(value)
  }

  return { file, exportName }
}

/**
 * Checks the `foundations` option before any test runs, so a typo in the
 * theme path fails the run instead of an empty Foundations view.
 */
export function validateFoundations(value: unknown): FoundationsOption {
  if (value === undefined) {
    return { enabled: true }
  }

  if (value === false) {
    return { enabled: false }
  }

  if (!isPlainObject(value)) {
    throw new Error('describe-me: foundations must be false or { theme }')
  }

  if (value.theme === undefined) {
    return { enabled: true }
  }

  return { enabled: true, theme: parseTheme(value.theme) }
}
