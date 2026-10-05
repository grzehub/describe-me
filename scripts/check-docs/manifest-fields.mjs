import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = 'how-it-works.html'
const SECTION = 'manifest'
const ROW_PREFIX = 'manifest-'
const TYPES = 'packages/core/src/types.ts'
const COMMENT = /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm
const INTERFACE = /\bexport\s+interface\s+Manifest\s*\{/
const FIELD = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:/

/**
 * how-it-works.html documents every field of `manifest.json`. Each field of
 * `interface Manifest` in packages/core/src/types.ts has a row
 * `<tr id="manifest-<field>">` in the `#manifest` section, whose first cell
 * shows the field name in `<code>`. Every `manifest-*` id names a field. An
 * interface that cannot be found, or has no fields, is a problem, so a
 * refactor cannot make the check pass on nothing.
 */
export default function manifestFields(context) {
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [`${PAGE}: the page is missing`]
  }

  const fields = manifestFieldNames(context.root)

  if (fields.length === 0) {
    return [`${PAGE}: found no fields of interface Manifest in ${TYPES}`]
  }

  const section = manifestSection(context, html)

  if (section === null) {
    return [`${PAGE}: has no <h2 id="${SECTION}"> section`]
  }

  const problems = fields.flatMap((field) => checkRow(context, section, field))

  for (const id of context.helpers.idsIn(html)) {
    if (id.startsWith(ROW_PREFIX) && !fields.includes(id.slice(ROW_PREFIX.length))) {
      problems.push(`${PAGE}: ${id} names no field of interface Manifest in ${TYPES}`)
    }
  }

  return problems
}

/** The names of the fields of `interface Manifest`, at the top level of its body. */
function manifestFieldNames(root) {
  const source = readFileSync(join(root, TYPES), 'utf8').replace(COMMENT, '')
  const head = INTERFACE.exec(source)

  if (!head) {
    return []
  }

  return topLevelText(source, head.index + head[0].length)
    .split(/[\n;]/)
    .map((line) => FIELD.exec(line)?.[1])
    .filter((name) => name !== undefined)
}

/** A body that starts after its `{`, up to the matching `}`, with nested braces left out. */
function topLevelText(source, from) {
  let depth = 0
  let text = ''

  for (let index = from; index < source.length; index++) {
    const character = source[index]

    if (character === '{') {
      depth++
    } else if (character === '}') {
      if (depth === 0) {
        break
      }

      depth--
    } else if (depth === 0) {
      text += character
    }
  }

  return text
}

/** The `#manifest` section of `main`, from its `h2` to the next one. */
function manifestSection(context, html) {
  const main = context.helpers.pagePart(html, 'main')

  if (main === null) {
    return null
  }

  const headings = context.helpers.startTags(main).filter((tag) => tag.name === 'h2')
  const start = headings.findIndex((tag) => tag.attributes.id === SECTION)

  if (start < 0) {
    return null
  }

  const end = headings[start + 1]?.index ?? main.length

  return main.slice(headings[start].index, end)
}

function checkRow(context, section, field) {
  const id = `${ROW_PREFIX}${field}`
  const { decodeEntities, startTags, stripTags } = context.helpers
  const tags = startTags(section)
  const row = tags.find((tag) => tag.attributes.id === id)

  if (!row) {
    return [`${PAGE}: no <tr id="${id}"> in #${SECTION} for the field ${field} of Manifest`]
  }

  if (row.name !== 'tr') {
    return [`${PAGE}: ${id} is on a <${row.name}>, it belongs on a <tr>`]
  }

  const rowEnd = section.indexOf('</tr', row.end)
  const cell = tags.find(
    (tag) =>
      tag.index > row.index &&
      (rowEnd < 0 || tag.index < rowEnd) &&
      (tag.name === 'td' || tag.name === 'th'),
  )

  const cellEnd = cell ? section.indexOf(`</${cell.name}`, cell.end) : -1
  const firstCell = cell ? section.slice(cell.end, cellEnd < 0 ? section.length : cellEnd) : ''

  const shown = startTags(firstCell)
    .filter((tag) => tag.name === 'code')
    .map((tag) => {
      const close = firstCell.indexOf('</code', tag.end)

      return decodeEntities(stripTags(firstCell.slice(tag.end, close < 0 ? undefined : close)))
    })

  if (!shown.some((text) => text.trim() === field)) {
    return [`${PAGE}: the first cell of ${id} needs <code>${field}</code>`]
  }

  return []
}
