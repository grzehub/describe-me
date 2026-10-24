import { inspect } from 'node:util'
import picomatch from 'picomatch'

/** Whether a path, or a part of one, matches a glob. Paths use `/` separators. */
export type SidebarMatcher = (path: string) => boolean

/** One glob of a group key, compiled. */
export interface SidebarGlob {
  glob: string
  matches: SidebarMatcher
  /**
   * For a key with a `*` segment: the glob's text before and after its capture
   * segment. `before` is `null` when the capture segment comes first.
   */
  capture?: { before: SidebarMatcher | null; after: SidebarMatcher }
}

/** One key of `sidebar.groups`, checked. */
export interface SidebarGroupRule {
  /** The key as written, for messages. */
  key: string
  /** The group path, outermost first, each name trimmed. */
  segments: string[]
  /** The index of the `*` segment, or `null` for a literal path. */
  placeholder: number | null
  globs: SidebarGlob[]
}

/** The `sidebar` option of `describeMe()` and of the reporter, checked. */
export interface SidebarOption {
  /** The rules in key order, which decides the first match. */
  groups: SidebarGroupRule[]
}

const GLOB_OPTIONS = { dot: true, windows: false }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype: unknown = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

function groupKeyError(key: string, problem: string): Error {
  return new Error(`describe-me: sidebar.groups key ${inspect(key)} ${problem}`)
}

function segmentsOf(key: string): string[] {
  const segments = key.split('/').map((segment) => segment.trim())

  if (segments.length === 1 && segments[0] === '') {
    throw groupKeyError(key, 'is empty. Give the group a name.')
  }

  if (segments.some((segment) => segment === '')) {
    throw groupKeyError(key, 'has an empty group name. Separate levels with single slashes.')
  }

  return segments
}

function placeholderOf(key: string, segments: string[]): number | null {
  const placeholders = segments.filter((segment) => segment === '*').length

  if (placeholders > 1) {
    throw groupKeyError(key, 'has more than one * segment')
  }

  return placeholders === 1 ? segments.indexOf('*') : null
}

function globsOf(key: string, value: unknown): string[] {
  const list: unknown[] = Array.isArray(value) ? value : [value]
  const valid = list.length > 0 && list.every((glob) => typeof glob === 'string' && glob !== '')

  if (!valid) {
    throw new Error(
      `describe-me: sidebar.groups[${inspect(key)}] expects a non-empty glob string or a non-empty list of them, got ${inspect(value)}`,
    )
  }

  return list as string[]
}

/** The glob's text around its capture segment, or `null` when it has no valid one. */
function captureParts(glob: string): { before: string; after: string } | null {
  const segments = (glob.startsWith('./') ? glob.slice(2) : glob).split('/')
  const index = segments.indexOf('*')

  if (index === -1 || index === segments.length - 1) {
    return null
  }

  if (segments.slice(0, index).some((segment) => segment.includes('**'))) {
    return null
  }

  return {
    before: segments.slice(0, index).join('/'),
    after: segments.slice(index + 1).join('/'),
  }
}

function captureOf(key: string, glob: string): SidebarGlob['capture'] {
  const parts = captureParts(glob)

  if (parts === null) {
    throw new Error(
      `describe-me: sidebar.groups[${inspect(key)}] names its groups after a * segment, so the glob ${inspect(glob)} needs a segment that is exactly *, before any ** and not the last`,
    )
  }

  // picomatch throws on an empty pattern, and an empty text matches only an empty path.
  const before = parts.before === '' ? null : picomatch(parts.before, GLOB_OPTIONS)

  return { before, after: picomatch(parts.after, GLOB_OPTIONS) }
}

function ruleOf(key: string, value: unknown): SidebarGroupRule {
  const segments = segmentsOf(key)
  const placeholder = placeholderOf(key, segments)

  const globs = globsOf(key, value).map((glob): SidebarGlob => {
    const matches = picomatch(glob, GLOB_OPTIONS)

    if (placeholder === null) {
      return { glob, matches }
    }

    return { glob, matches, capture: captureOf(key, glob) }
  })

  return { key, segments, placeholder, globs }
}

/**
 * Checks the `sidebar` option before any test runs, so a typo in a group key
 * or a glob fails the run instead of a sidebar without groups.
 */
export function validateSidebar(value: unknown): SidebarOption {
  if (value === undefined) {
    return { groups: [] }
  }

  if (!isPlainObject(value)) {
    throw new Error(
      `describe-me: sidebar must be an object such as { groups }, got ${inspect(value)}`,
    )
  }

  for (const key of Object.keys(value)) {
    if (key !== 'groups') {
      throw new Error(`describe-me: sidebar.${key} is not an option. sidebar takes groups.`)
    }
  }

  const { groups } = value

  if (groups === undefined) {
    return { groups: [] }
  }

  if (!isPlainObject(groups)) {
    throw new Error(
      `describe-me: sidebar.groups must be an object of group paths and globs, got ${inspect(groups)}`,
    )
  }

  return { groups: Object.entries(groups).map(([key, globs]) => ruleOf(key, globs)) }
}
