import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = 'troubleshooting.html'
const TYPES = 'packages/core/src/types.ts'
// Line comments only where `//` cannot be part of a URL in a string.
const COMMENT = /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm
const STATUS_TYPE = /\bexport\s+type\s+LiveStatus\s*=((?:\s*\|?\s*(?:'[^']*'|"[^"]*"))+)/
const STRING_LITERAL = /'([^']*)'|"([^"]*)"/g

/**
 * troubleshooting.html explains every status of the live preview: each member
 * of `LiveStatus` in packages/core/src/types.ts has an element
 * `live-<status>` in #live, and every `live-` id on the page names a member.
 * Finding no member is a problem, so a refactor cannot make the check vacuous.
 */
export default function liveStatuses(context) {
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [`${PAGE}: the page is missing, so the live statuses cannot be checked`]
  }

  const statuses = liveStatusMembers(context.root)

  if (statuses.length === 0) {
    return [`${PAGE}: found no members of LiveStatus in ${TYPES} (export type LiveStatus)`]
  }

  const main = context.helpers.pagePart(html, 'main') ?? ''
  const section = sectionOf(main, 'live', context.helpers)

  if (section === null) {
    return [`${PAGE}: has no h2 #live for the members of LiveStatus`]
  }

  const inSection = new Set(context.helpers.idsIn(section))
  const problems = []

  for (const status of statuses) {
    if (!inSection.has(`live-${status}`)) {
      problems.push(`${PAGE}: no row live-${status} in #live for the LiveStatus '${status}'`)
    }
  }

  for (const id of context.helpers.idsIn(html)) {
    if (id.startsWith('live-') && !statuses.includes(id.slice('live-'.length))) {
      problems.push(`${PAGE}: ${id} names no member of LiveStatus in ${TYPES}`)
    }
  }

  return problems
}

/** The string literals of `export type LiveStatus = 'mounted' | …`, also over several lines. */
function liveStatusMembers(root) {
  const file = join(root, TYPES)

  if (!existsSync(file)) {
    return []
  }

  const source = readFileSync(file, 'utf8').replace(COMMENT, '$1')
  const union = STATUS_TYPE.exec(source)

  if (!union) {
    return []
  }

  return [...union[1].matchAll(STRING_LITERAL)].map((match) => match[1] ?? match[2])
}

/** The HTML from `<h2 id="…">` to the next `h2` or the end of `main`, or `null` without that `h2`. */
function sectionOf(main, id, helpers) {
  const heading = helpers
    .startTags(main)
    .find((tag) => tag.name === 'h2' && tag.attributes.id === id)

  if (!heading) {
    return null
  }

  const next = main.slice(heading.end).search(/<h2[\s>]/i)

  return next < 0 ? main.slice(heading.index) : main.slice(heading.index, heading.end + next)
}
