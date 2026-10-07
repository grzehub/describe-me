import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exampleNames } from '../docs/example-names.mjs'

const SITE = 'https://grzehub.github.io/describe-me/'
const DOCS_LINK = `**[Read the docs](${SITE})**`
// The first lines are what npm shows above the fold.
const DOCS_LINK_WITHIN = 12
// A README that grows past this is copying the docs. Link the page instead.
const MAX_LINES = 80
const PACKAGE_TABLE = '## Which package do I need'
const QUICK_START = '## Quick start'

/**
 * The package READMEs are what npm shows, so they share one shape: the docs
 * link near the top, links to both example viewers, a table of all four
 * packages, the same quick start, and no more than a short page. Details live
 * in the docs, where they have one home.
 */
export default function packageReadmes(context) {
  const problems = []
  const quickStarts = new Map()

  for (const pkg of context.packages) {
    const file = `${pkg.dir}/README.md`
    const path = join(context.root, file)

    if (!existsSync(path)) {
      continue
    }

    const text = readFileSync(path, 'utf8')
    const lines = text.split('\n')

    problems.push(...shapeProblems(file, text, lines, context))
    quickStarts.set(file, section(lines, QUICK_START))
  }

  const [first, ...others] = [...quickStarts.entries()]

  for (const [file, quickStart] of others) {
    if (quickStart !== first[1]) {
      problems.push(`${file}: "${QUICK_START}" differs from the one in ${first[0]}`)
    }
  }

  return problems
}

function shapeProblems(file, text, lines, context) {
  const problems = []
  const docsLine = lines.findIndex((line) => line.includes(DOCS_LINK))

  if (docsLine < 0 || docsLine >= DOCS_LINK_WITHIN) {
    problems.push(`${file}: ${DOCS_LINK} must be within the first ${DOCS_LINK_WITHIN} lines`)
  }

  for (const name of exampleNames) {
    if (!text.includes(`${SITE}examples/${name}/`)) {
      problems.push(`${file}: does not link the ${name} example viewer`)
    }
  }

  const table = section(lines, PACKAGE_TABLE)

  if (table === null) {
    problems.push(`${file}: has no "${PACKAGE_TABLE}"`)
  } else {
    for (const pkg of context.packages) {
      if (!table.includes(`\`${pkg.name}\``)) {
        problems.push(`${file}: "${PACKAGE_TABLE}" does not list ${pkg.name}`)
      }
    }
  }

  if (section(lines, QUICK_START) === null) {
    problems.push(`${file}: has no "${QUICK_START}"`)
  }

  if (lines.length > MAX_LINES) {
    problems.push(
      `${file}: ${lines.length} lines, at most ${MAX_LINES}. Link the docs page instead`,
    )
  }

  return problems
}

/** The text under a `## ` heading, up to the next one, or `null` without the heading. */
function section(lines, heading) {
  const start = lines.indexOf(heading)

  if (start < 0) {
    return null
  }

  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))

  return lines.slice(start + 1, end < 0 ? lines.length : end).join('\n')
}
