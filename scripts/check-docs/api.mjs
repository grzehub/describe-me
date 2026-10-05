import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { exportedNames } from '../docs/exported-names.mjs'

const PAGE = 'api.html'
const ENTRY_PREFIX = 'entry-'
const SCOPE = '@describe-me/'
const DIST_TARGET = /^\.\/dist\/(.+)\.js$/

/**
 * api.html documents every entry point of the published packages and every
 * name each one exports. Each subpath of a package's `exports` has an `h3`
 * with the id `entry-<package>[-<subpath>]` in the section of its package,
 * and the CLI package, which has only `bin`, has `entry-cli`. The block under
 * the heading names its specifier and every export of its source in
 * `<code>`, and every package its source passes on with `export *`. Every
 * `entry-*` id names an entry point. A source that cannot be found is a
 * problem, so the check never passes on nothing.
 */
export default function api(context) {
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [`${PAGE}: the page is missing`]
  }

  const main = context.helpers.pagePart(html, 'main')

  if (main === null) {
    return [`${PAGE}: has no <main class="page">`]
  }

  const page = { context, main, tags: context.helpers.startTags(main) }
  const problems = []
  const expectedIds = new Set()

  for (const pkg of context.packages) {
    const entries = entryPointsOf(pkg)

    if (entries.length === 0) {
      problems.push(`${PAGE}: ${pkg.name} has neither exports nor bin in its package.json`)
    }

    for (const entry of entries) {
      expectedIds.add(entry.id)
      problems.push(...checkEntry(page, pkg, entry))
    }
  }

  for (const id of context.helpers.idsIn(main)) {
    if (id.startsWith(ENTRY_PREFIX) && !expectedIds.has(id)) {
      problems.push(`${PAGE}: ${id} matches no entry point of the published packages`)
    }
  }

  return problems
}

/** `@describe-me/vitest` → `vitest`, and `cli` for the `describe-me` package. */
function shortName(name) {
  return name.startsWith(SCOPE) ? name.slice(SCOPE.length) : 'cli'
}

/** Each entry point of a package: its heading id, its import specifier and its `exports` target. */
function entryPointsOf(pkg) {
  const short = shortName(pkg.name)

  if (pkg.json.exports === undefined) {
    return pkg.json.bin === undefined
      ? []
      : [{ id: `${ENTRY_PREFIX}${short}`, short, specifier: pkg.name, target: null }]
  }

  return Object.entries(pkg.json.exports).map(([subpath, target]) => {
    const suffix = subpath === '.' ? '' : `-${subpath.slice(2).replaceAll('/', '-')}`

    return {
      id: `${ENTRY_PREFIX}${short}${suffix}`,
      short,
      subpath,
      specifier: pkg.name + subpath.slice(1),
      target,
    }
  })
}

function checkEntry(page, pkg, entry) {
  const heading = page.tags.find((tag) => tag.attributes.id === entry.id)

  if (!heading) {
    return [`${PAGE}: no <h3 id="${entry.id}"> for ${entry.specifier}`]
  }

  if (heading.name !== 'h3') {
    return [`${PAGE}: ${entry.id} is on an <${heading.name}>, it belongs on an <h3>`]
  }

  const problems = []
  const section = sectionOf(page, heading)

  if (section !== entry.short) {
    problems.push(
      `${PAGE}: ${entry.id} sits under ${section ? `#${section}` : 'no h2'}, it belongs in the section #${entry.short}`,
    )
  }

  const codes = codeTexts(page, heading)

  if (!codes.includes(entry.specifier)) {
    problems.push(`${PAGE}: ${entry.id} does not show ${entry.specifier} in <code>`)
  }

  if (entry.target === null) {
    return problems
  }

  const source = sourceOf(page.context, pkg, entry)

  if (source.problem) {
    return [...problems, source.problem]
  }

  const { names, reexported } = exportedNames(source.file)

  for (const name of names) {
    if (!codes.some((code) => namesWhole(code, name, /[\w$]/))) {
      problems.push(`${PAGE}: ${entry.id} does not name ${name} in <code>`)
    }
  }

  for (const specifier of reexported) {
    if (!codes.some((code) => namesWhole(code, specifier, /[\w$@/.-]/))) {
      problems.push(
        `${PAGE}: ${entry.id} does not name ${specifier}, which it re-exports, in <code>`,
      )
    }
  }

  return problems
}

/** The id of the last `h2` before a heading. */
function sectionOf(page, heading) {
  const before = page.tags.filter((tag) => tag.name === 'h2' && tag.index < heading.index)

  return before.at(-1)?.attributes.id ?? null
}

/**
 * The text of every `<code>` in an entry point's block, which runs from its
 * heading to the next `h2`, the next entry point heading or the end of `main`.
 */
function codeTexts(page, heading) {
  const next = page.tags.find(
    (tag) =>
      tag.index > heading.index &&
      (tag.name === 'h2' ||
        (tag.name === 'h3' && (tag.attributes.id ?? '').startsWith(ENTRY_PREFIX))),
  )

  const block = page.main.slice(heading.index, next ? next.index : page.main.length)
  const { decodeEntities, startTags, stripTags } = page.context.helpers

  return startTags(block)
    .filter((tag) => tag.name === 'code')
    .map((tag) => {
      const close = block.indexOf('</code', tag.end)
      const inner = block.slice(tag.end, close < 0 ? block.length : close)

      return decodeEntities(stripTags(inner)).replace(/\s+/g, ' ').trim()
    })
}

/** The `.ts` file behind an entry point, the way the build maps `src/` to `dist/`. */
function sourceOf(context, pkg, entry) {
  const target = exportTarget(entry.target)
  const match = target?.match(DIST_TARGET)

  if (!match) {
    return {
      problem: `${PAGE}: ${entry.specifier} points at ${target ?? 'nothing'}, not ./dist/<name>.js, so its source is unknown`,
    }
  }

  const file = join(context.root, pkg.dir, 'src', `${match[1]}.ts`)

  if (!existsSync(file)) {
    return { problem: `${PAGE}: ${entry.specifier} has no source at ${pkg.dir}/src/${match[1]}.ts` }
  }

  return { file }
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

/** Whether `text` holds `word` with no character of `edge` on either side. */
function namesWhole(text, word, edge) {
  let from = text.indexOf(word)

  while (from >= 0) {
    const before = text[from - 1] ?? ''
    const after = text[from + word.length] ?? ''

    if (!edge.test(before) && !edge.test(after)) {
      return true
    }

    from = text.indexOf(word, from + 1)
  }

  return false
}
