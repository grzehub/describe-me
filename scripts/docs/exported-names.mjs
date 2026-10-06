import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Line comments only at the start of a line, so `//` in a URL string stays.
const COMMENT = /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm
const DECLARED =
  /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|class|interface|type|enum|namespace)\s+([\w$]+)/g

const DEFAULT =
  /\bexport\s+default\s+(?:abstract\s+)?(?:async\s+)?(?:(?:function\s*\*?\s*|class\s+)(?!extends\b|implements\b)([\w$]+))?/g

const LISTED = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g
const STARRED = /\bexport\s+\*\s+(?:as\s+([\w$]+)\s+)?from\s*(['"])([^'"]+)\2/g

/**
 * What a TypeScript source exports, so a page can be held to it. `names` has
 * every exported name, with `export * from './local.js'` followed into the
 * local file. A default export counts under its declared name, or as
 * `default` when it has none. `reexported` has the packages that
 * `export * from 'pkg'` passes on whole.
 */
export function exportedNames(file) {
  const found = { names: new Set(), reexported: new Set() }

  collect(file, found, new Set(), true)

  return { names: [...found.names], reexported: [...found.reexported] }
}

/** `export *` never passes on a default export, so only the first file adds its own. */
function collect(file, found, seen, withDefault) {
  if (seen.has(file)) {
    return
  }

  seen.add(file)

  const text = readFileSync(file, 'utf8').replace(COMMENT, '')

  for (const match of text.matchAll(DECLARED)) {
    found.names.add(match[1])
  }

  for (const match of text.matchAll(LISTED)) {
    for (const name of listedNames(match[1])) {
      found.names.add(name)
    }
  }

  if (withDefault) {
    for (const match of text.matchAll(DEFAULT)) {
      found.names.add(match[1] ?? 'default')
    }
  }

  for (const match of text.matchAll(STARRED)) {
    const [, alias, , specifier] = match

    if (alias) {
      found.names.add(alias)
    } else if (specifier.startsWith('.')) {
      collect(localSource(dirname(file), specifier), found, seen, false)
    } else {
      found.reexported.add(specifier)
    }
  }
}

/** The names an `export { … }` list gives: `a`, `b` for `a as b` and `a` for `type a`. */
function listedNames(list) {
  return list
    .split(',')
    .map((part) => {
      const [from, to] = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)

      return (to ?? from).trim()
    })
    .filter(Boolean)
}

/** The `.ts` source behind a local specifier such as `./types.js`. */
function localSource(directory, specifier) {
  const base = join(directory, specifier.replace(/\.js$/, ''))
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}
