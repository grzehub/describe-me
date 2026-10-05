import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const IMPORT_FROM = /\bimport\b([^'";]*?)\bfrom\s*(['"])([^'"\n]+)\2/g
const STRING = /(['"`])(@describe-me\/[a-z0-9-]+(?:\/[a-z0-9._-]+)*)\1/g
const OUR_PACKAGE = /^(?:describe-me|@describe-me\/[a-z0-9-]+)(?=\/|$)/
const COMMENT = /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm
const DECLARED =
  /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|class|interface|type|enum|namespace)\s+([\w$]+)/g

const LISTED = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g
const STARRED = /\bexport\s+\*\s+(?:as\s+([\w$]+)\s+)?from\s*(['"])([^'"]+)\2/g
const DEFAULT = /\bexport\s+default\b/

/**
 * Code samples import only what the packages export. Every `describe-me` or
 * `@describe-me/…` specifier in a `<pre><code>` block, in an import or in a
 * config string, is an entry point of its package, and every named or default
 * import is exported by the source of that entry point.
 */
export default function codeSamples(context) {
  const entries = new EntryPoints(context)
  const problems = []

  for (const [file, html] of context.html) {
    for (const code of context.helpers.codeBlocks(html)) {
      problems.push(...checkStrings(file, code, entries), ...checkImports(file, code, entries))
    }
  }

  return problems
}

function checkStrings(file, code, entries) {
  return [...code.matchAll(STRING)]
    .map((match) => entries.subpathProblem(match[2]))
    .filter(Boolean)
    .map((problem) => `${file}: ${problem}`)
}

function checkImports(file, code, entries) {
  const problems = []

  for (const match of code.matchAll(IMPORT_FROM)) {
    const specifier = match[3]

    if (!OUR_PACKAGE.test(specifier)) {
      continue
    }

    const statement = match[0].replace(/\s+/g, ' ')

    if (specifier === 'describe-me' || specifier.startsWith('describe-me/')) {
      problems.push(`${file}: ${statement}: describe-me is the CLI and exports nothing to import`)

      continue
    }

    // A wrong subpath is reported once, by checkStrings.
    const exported = entries.exportsOf(specifier)

    if (exported === null || exported.open) {
      continue
    }

    for (const name of importedNames(match[1])) {
      if (!exported.names.has(name)) {
        problems.push(`${file}: ${statement}: ${missingExport(entries, specifier, name, exported)}`)
      }
    }
  }

  return problems
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
    const name = specifier.match(OUR_PACKAGE)[0]

    return { name, subpath: `.${specifier.slice(name.length)}` }
  }

  /** Why a specifier is not an entry point, or `null` when it is one. */
  subpathProblem(specifier) {
    const { name, subpath } = this.split(specifier)
    const pkg = this.packages.get(name)

    if (!pkg) {
      return `'${specifier}': there is no package ${name}`
    }

    const exports = Object.keys(pkg.json.exports ?? {})

    if (!exports.includes(subpath)) {
      const known = exports.length > 0 ? exports.join(', ') : 'nothing'

      return `'${specifier}' is not an entry point of ${name}, which exports ${known}`
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
