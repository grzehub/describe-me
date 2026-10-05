import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

// At the start of a line, so the word "import" in a comment above does not join the statement.
const IMPORT_FROM = /^[ \t]*import\b([^'";]*?)\bfrom\s*(['"])([^'"\n]+)\2/gm
// `import 'x'` and `import('x')`, which take no names.
const IMPORT_ONLY = /\bimport\s*(\(\s*)?(['"`])([^'"`\n]+)\2/g
// Quoted text shaped exactly like a specifier, in any case, so a typo such as `setupDom` is
// caught. Globs, prefixes, versions and pnpm selectors (`@describe-me/*`, `@describe-me/`,
// `@describe-me/vitest@^0.5`, `@describe-me/vitest>vitest`) name packages in install commands,
// Renovate rules and overrides. They are not entry points, so they do not match.
const STRING = /(['"`])(@describe-me\/[\w.~-]+(?:\/[\w.~-]+)*)\1/g
const SCOPE = '@describe-me'
const COMMENT = /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm
const DECLARED =
  /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|class|interface|type|enum|namespace)\s+([\w$]+)/g

const LISTED = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g
const STARRED = /\bexport\s+\*\s+(?:as\s+([\w$]+)\s+)?from\s*(['"])([^'"]+)\2/g
const DEFAULT = /\bexport\s+default\b/
const CLI_PROBLEM = 'describe-me is the CLI and exports nothing to import'

/**
 * Code samples import only what the packages export. In a `<pre><code>` block,
 * every import of `describe-me` or `@describe-me/…` (with names, for side
 * effects or dynamic) names an entry point of its package, and so does every
 * other quoted `@describe-me/…` specifier, such as a `setupFiles` entry.
 * `describe-me` is the CLI and has none. Every named or default import is
 * exported by the source of its entry point.
 */
export default function codeSamples(context) {
  const entries = new EntryPoints(context)
  const problems = []

  for (const [file, html] of context.html) {
    for (const code of context.helpers.codeBlocks(html)) {
      for (const use of specifiersIn(code)) {
        problems.push(...checkSpecifier(use, entries).map((problem) => `${file}: ${problem}`))
      }
    }
  }

  return problems
}

/**
 * Every use of one of our packages in a code block: each import with its
 * statement and the names it takes, then every other quoted specifier.
 */
function specifiersIn(code) {
  const uses = []
  const importQuotes = new Set()

  for (const match of code.matchAll(IMPORT_FROM)) {
    importQuotes.add(quoteIndex(match))
    uses.push({
      statement: match[0].trim().replace(/\s+/g, ' '),
      specifier: match[3],
      names: importedNames(match[1]),
    })
  }

  for (const match of code.matchAll(IMPORT_ONLY)) {
    importQuotes.add(quoteIndex(match))
    uses.push({
      statement: match[1] ? `import('${match[3]}')` : `import '${match[3]}'`,
      specifier: match[3],
      names: [],
    })
  }

  for (const match of code.matchAll(STRING)) {
    if (!importQuotes.has(match.index)) {
      uses.push({ statement: null, specifier: match[2], names: [] })
    }
  }

  return uses.filter((use) => packageOf(use.specifier) !== null)
}

/** Where the specifier's opening quote is. Both import patterns end with the closing quote. */
function quoteIndex(match) {
  return match.index + match[0].length - match[3].length - 2
}

/** The package a specifier belongs to, if it is one of ours: `describe-me` or `@describe-me/<name>`. */
function packageOf(specifier) {
  if (specifier === 'describe-me' || specifier.startsWith('describe-me/')) {
    return 'describe-me'
  }

  if (specifier !== SCOPE && !specifier.startsWith(`${SCOPE}/`)) {
    return null
  }

  const slash = specifier.indexOf('/', SCOPE.length + 1)

  return slash < 0 ? specifier : specifier.slice(0, slash)
}

function checkSpecifier(use, entries) {
  const where = use.statement ?? `'${use.specifier}'`

  if (packageOf(use.specifier) === 'describe-me') {
    // Outside an import, `describe-me` is a package name, as in package.json.
    return use.statement ? [`${where}: ${CLI_PROBLEM}`] : []
  }

  const problem = entries.subpathProblem(use.specifier)

  if (problem !== null) {
    return [`${where}: ${problem}`]
  }

  const exported = entries.exportsOf(use.specifier)

  if (exported.open) {
    return []
  }

  return use.names
    .filter((name) => !exported.names.has(name))
    .map((name) => `${where}: ${missingExport(entries, use.specifier, name, exported)}`)
}

function missingExport(entries, specifier, name, exported) {
  if (name === 'default') {
    return `${specifier} has no default export (${exported.source})`
  }

  const elsewhere = entries.entriesExporting(specifier, name)
  const hint = elsewhere.length > 0 ? `. Import it from ${elsewhere.join(' or ')}` : ''

  return `${specifier} does not export ${name} (${exported.source})${hint}`
}

/** The names an import clause takes from its module: `default` for a default import. */
function importedNames(clause) {
  const text = clause.trim().replace(/^type\s+/, '')
  const names = []
  const braces = text.match(/\{([^}]*)\}/)
  const outside = text
    .replace(/\{[^}]*\}/, '')
    .replace(/,/g, ' ')
    .trim()

  if (outside && !outside.startsWith('*')) {
    names.push('default')
  }

  for (const part of braces ? braces[1].split(',') : []) {
    const { from } = listEntry(part)

    if (from) {
      names.push(from)
    }
  }

  return names
}

/** One entry of an import or export list (`a`, `a as b`, `type a`): the name it takes and the name it gives. */
function listEntry(part) {
  const [from, to] = part
    .trim()
    .replace(/^type\s+/, '')
    .split(/\s+as\s+/)

  return { from: from.trim(), to: (to ?? from).trim() }
}

/** The entry points of the published packages and what each one exports, read once. */
class EntryPoints {
  constructor(context) {
    this.root = context.root
    this.packages = new Map(context.packages.map((pkg) => [pkg.name, pkg]))
    this.cache = new Map()
  }

  split(specifier) {
    const name = packageOf(specifier)

    return { name, subpath: `.${specifier.slice(name.length)}` }
  }

  /** Why a specifier is not an entry point, or `null` when it is one. */
  subpathProblem(specifier) {
    const { name, subpath } = this.split(specifier)
    const pkg = this.packages.get(name)

    if (!pkg) {
      return `there is no package ${name}${suggestion([...this.packages.keys()], name)}`
    }

    const exports = Object.keys(pkg.json.exports ?? {})

    if (!exports.includes(subpath)) {
      const known = exports.length > 0 ? exports.join(', ') : 'nothing'
      const specifiers = exports.map((entry) => name + entry.slice(1))

      return `not an entry point of ${name}, which exports ${known}${suggestion(specifiers, specifier)}`
    }

    return null
  }

  /** The names an entry point exports and the source they come from, or `null` for no entry point. */
  exportsOf(specifier) {
    if (this.subpathProblem(specifier) !== null) {
      return null
    }

    if (!this.cache.has(specifier)) {
      this.cache.set(specifier, this.read(specifier))
    }

    return this.cache.get(specifier)
  }

  read(specifier) {
    const { name, subpath } = this.split(specifier)
    const pkg = this.packages.get(name)
    const target = exportTarget(pkg.json.exports[subpath])
    const source = target?.match(/^\.\/dist\/(.+)\.js$/)

    if (!source) {
      return { names: new Set(), open: true, source: target }
    }

    const file = join(this.root, pkg.dir, 'src', `${source[1]}.ts`)
    const collected = { names: new Set(), open: false }
    collectExports(file, collected, new Set())

    return { ...collected, source: relative(this.root, file) }
  }

  /** Other entry points of the same package that export `name`, to point at the right import. */
  entriesExporting(specifier, name) {
    const { name: packageName, subpath } = this.split(specifier)
    const pkg = this.packages.get(packageName)

    return Object.keys(pkg.json.exports ?? {})
      .filter((other) => other !== subpath)
      .map((other) => packageName + other.slice(1))
      .filter((other) => {
        const exported = this.exportsOf(other)

        return exported !== null && !exported.open && exported.names.has(name)
      })
  }
}

/** A hint for a slip in case or separators, such as `setupDom` for `setup-dom`. */
function suggestion(candidates, written) {
  const loose = (text) => text.toLowerCase().replace(/[^a-z0-9@]/g, '')
  const match = candidates.find((candidate) => loose(candidate) === loose(written))

  return match ? `. Did you mean ${match}?` : ''
}

function exportTarget(target) {
  if (typeof target === 'string') {
    return target
  }

  if (target && typeof target === 'object') {
    return exportTarget(target.import ?? target.default)
  }

  return null
}

/** Adds the names a source file exports, following `export * from './…'` into local files. */
function collectExports(file, collected, seen) {
  if (seen.has(file) || !existsSync(file)) {
    return
  }

  seen.add(file)

  const text = readFileSync(file, 'utf8').replace(COMMENT, '')

  for (const match of text.matchAll(DECLARED)) {
    collected.names.add(match[1])
  }

  if (DEFAULT.test(text)) {
    collected.names.add('default')
  }

  for (const match of text.matchAll(LISTED)) {
    for (const part of match[1].split(',')) {
      const { to } = listEntry(part)

      if (to) {
        collected.names.add(to)
      }
    }
  }

  for (const match of text.matchAll(STARRED)) {
    if (match[1]) {
      collected.names.add(match[1])
    } else if (match[3].startsWith('.')) {
      collectExports(localSource(dirname(file), match[3]), collected, seen)
    } else {
      // Re-exports another package, which this check does not read.
      collected.open = true
    }
  }
}

function localSource(directory, specifier) {
  const base = join(directory, specifier.replace(/\.js$/, ''))
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}
