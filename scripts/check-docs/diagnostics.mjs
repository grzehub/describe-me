import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TROUBLESHOOTING = 'troubleshooting.html'
const LIMITATIONS = 'limitations.html'
const TYPES = 'packages/core/src/types.ts'
const INTERFACE = /\binterface\s+ManifestDiagnostics\b[^{]*\{/
const KEY = /^\s*([A-Za-z_$][\w$]*)\s*\??:/
const ENVIRONMENTS = ['browser mode', 'jsdom', 'both', 'viewer', 'build']
const STATUSES = ['status-open', 'status-planned', 'status-by-design', 'status-fixed']
const FIXED_TEXT = /^fixed in \d+\.\d+\.\d+$/

/**
 * troubleshooting.html explains every diagnostic: each key of
 * `ManifestDiagnostics` in packages/core/src/types.ts has an element
 * `diag-<key>` in #diagnostics, and every `diag-` id names a key.
 * limitations.html tags every limitation: each `limit-` id sits on a `tr` of
 * #summary, which holds an environment badge, exactly one status badge and a
 * link. A `status-fixed` badge names the release, as in `fixed in 0.5.2`.
 */
export default function diagnostics(context) {
  return [...diagnosticProblems(context), ...limitationProblems(context)]
}

function diagnosticProblems(context) {
  const html = context.html.get(TROUBLESHOOTING)

  if (html === undefined) {
    return [`${TROUBLESHOOTING}: the page is missing, so the diagnostics cannot be checked`]
  }

  const keys = diagnosticKeys(context.root)

  if (keys.length === 0) {
    return [`${TROUBLESHOOTING}: found no keys of ManifestDiagnostics in ${TYPES}`]
  }

  const main = context.helpers.pagePart(html, 'main') ?? ''
  const section = sectionOf(main, 'diagnostics', context.helpers)

  if (section === null) {
    return [`${TROUBLESHOOTING}: has no h2 #diagnostics for the keys of ManifestDiagnostics`]
  }

  const inSection = new Set(context.helpers.idsIn(section))
  const problems = []

  for (const key of keys) {
    if (!inSection.has(`diag-${key}`)) {
      problems.push(
        `${TROUBLESHOOTING}: no row diag-${key} in #diagnostics for ManifestDiagnostics.${key}`,
      )
    }
  }

  for (const id of context.helpers.idsIn(html)) {
    if (id.startsWith('diag-') && !keys.includes(id.slice('diag-'.length))) {
      problems.push(`${TROUBLESHOOTING}: ${id} names no key of ManifestDiagnostics in ${TYPES}`)
    }
  }

  return problems
}

/** The property names at the top level of `interface ManifestDiagnostics`, or none without it. */
function diagnosticKeys(root) {
  const file = join(root, TYPES)

  if (!existsSync(file)) {
    return []
  }

  const source = readFileSync(file, 'utf8')
  const head = INTERFACE.exec(source)

  if (!head) {
    return []
  }

  return bodyOf(source, head.index + head[0].length)
    .split('\n')
    .map((line) => KEY.exec(line)?.[1])
    .filter((key) => key !== undefined)
}

/** The text of a body that starts after its `{`, up to the matching `}`. */
function bodyOf(source, from) {
  let depth = 0

  for (let index = from; index < source.length; index++) {
    if (source[index] === '{') {
      depth++
    } else if (source[index] === '}') {
      if (depth === 0) {
        return source.slice(from, index)
      }

      depth--
    }
  }

  return source.slice(from)
}

function limitationProblems(context) {
  const html = context.html.get(LIMITATIONS)

  if (html === undefined) {
    return [`${LIMITATIONS}: the page is missing, so the limitations cannot be checked`]
  }

  const main = context.helpers.pagePart(html, 'main') ?? ''
  const summary = sectionOf(main, 'summary', context.helpers)

  if (summary === null) {
    return [`${LIMITATIONS}: has no h2 #summary for the limit- rows`]
  }

  const tagged = context.helpers
    .startTags(html)
    .filter((tag) => (tag.attributes.id ?? '').startsWith('limit-'))

  const rows = context.helpers
    .startTags(summary)
    .filter((tag) => tag.name === 'tr' && (tag.attributes.id ?? '').startsWith('limit-'))

  const problems = []

  if (rows.length === 0) {
    problems.push(`${LIMITATIONS}: #summary has no tr with an id starting with limit-`)
  }

  const rowIds = new Set(rows.map((row) => row.attributes.id))

  for (const tag of tagged) {
    if (tag.name !== 'tr' || !rowIds.has(tag.attributes.id)) {
      problems.push(`${LIMITATIONS}: ${tag.attributes.id} must be a tr inside #summary`)
    }
  }

  for (const row of rows) {
    problems.push(...rowProblems(summary, row, context.helpers))
  }

  return problems
}

function rowProblems(summary, row, helpers) {
  const id = row.attributes.id
  const close = summary.indexOf('</tr', row.end)
  const body = summary.slice(row.end, close < 0 ? summary.length : close)
  const tags = helpers.startTags(body)
  const badges = tags.filter((tag) => tag.name === 'span' && classesOf(tag).includes('badge'))
  const problems = []

  const environments = badges.filter(
    (badge) =>
      classesOf(badge).includes('env') && ENVIRONMENTS.includes(textOf(body, badge, helpers)),
  )

  if (environments.length === 0) {
    problems.push(
      `${LIMITATIONS}: ${id} has no span.badge.env reading ${ENVIRONMENTS.map((name) => `"${name}"`).join(', ')}`,
    )
  }

  const statuses = badges.filter((badge) =>
    classesOf(badge).some((name) => STATUSES.includes(name)),
  )

  if (statuses.length !== 1) {
    problems.push(
      `${LIMITATIONS}: ${id} needs exactly one status badge (${STATUSES.join(', ')}), found ${statuses.length}`,
    )
  }

  for (const status of statuses) {
    const text = textOf(body, status, helpers)

    if (classesOf(status).includes('status-fixed') && !FIXED_TEXT.test(text)) {
      problems.push(
        `${LIMITATIONS}: ${id} has a status-fixed badge reading "${text}", expected "fixed in <major>.<minor>.<patch>"`,
      )
    }
  }

  if (!tags.some((tag) => tag.name === 'a' && tag.attributes.href)) {
    problems.push(`${LIMITATIONS}: ${id} has no link to the home of its details`)
  }

  return problems
}

function classesOf(tag) {
  return (tag.attributes.class ?? '').split(/\s+/)
}

/** The text of the element that starts with `tag`, up to its `</span>`, decoded and trimmed. */
function textOf(html, tag, helpers) {
  const close = html.indexOf('</span', tag.end)
  const inner = html.slice(tag.end, close < 0 ? html.length : close)

  return helpers.decodeEntities(helpers.stripTags(inner)).replace(/\s+/g, ' ').trim()
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
