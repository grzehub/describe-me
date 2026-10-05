import { elementWithId } from '../docs/element-with-id.mjs'

const PAGE = 'installation.html'
const CODE = /<code\b[^>]*>([\s\S]*?)<\/code>/gi

/**
 * installation.html shows every version range the published packages ask
 * for, exactly as their package.json writes it. Each peer dependency that is
 * not `workspace:` has a row `version-<slug>`, the name without `@` and with
 * `/` turned into `-`, and each `engines` key a row `version-<key>`. The row
 * holds a `<code>` with every distinct range of that name. Other rows may
 * stand next to them.
 */
export default function versions(context) {
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [`${PAGE}: the page is missing`]
  }

  const problems = []

  for (const [id, ranges] of expectedRows(context.packages)) {
    const row = elementWithId(html, id)

    if (row === null) {
      const sources = [...ranges.values()].flat().join(', ')
      problems.push(`${PAGE}: no element with id="${id}" for ${sources}`)

      continue
    }

    const shown = codeTexts(context, row)

    for (const [range, sources] of ranges) {
      if (!shown.includes(range)) {
        problems.push(`${PAGE}: ${id} needs <code>${range}</code> (${sources.join(', ')})`)
      }
    }
  }

  return problems
}

/** For each row id, every range it must show and where each comes from. */
function expectedRows(packages) {
  const rows = new Map()

  for (const pkg of packages) {
    for (const [name, range] of Object.entries(pkg.json.peerDependencies ?? {})) {
      if (!range.startsWith('workspace:')) {
        addRange(rows, `version-${slugOf(name)}`, range, `peer of ${pkg.name}`)
      }
    }

    for (const [key, range] of Object.entries(pkg.json.engines ?? {})) {
      addRange(rows, `version-${key}`, range, `engines.${key} of ${pkg.name}`)
    }
  }

  return rows
}

function addRange(rows, id, range, source) {
  const ranges = rows.get(id) ?? new Map()
  ranges.set(range, [...(ranges.get(range) ?? []), source])
  rows.set(id, ranges)
}

/** `@testing-library/react` → `testing-library-react`. */
function slugOf(name) {
  return name.replace(/^@/, '').replaceAll('/', '-')
}

/** The text of every `<code>` in a fragment, entities decoded and whitespace collapsed. */
function codeTexts(context, fragment) {
  return [...fragment.matchAll(CODE)].map((match) =>
    context.helpers.decodeEntities(context.helpers.stripTags(match[1])).replace(/\s+/g, ' ').trim(),
  )
}
