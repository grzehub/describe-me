import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VIEWER_CSS = 'packages/viewer/src/style.css'
const DOCS_CSS = 'docs/docs.css'
const COMMENT = /\/\*[\s\S]*?\*\//g
const LIGHT = /:root\s*\{([^}]*)\}/
const DARK = /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}/
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g

/**
 * The tokens at the top of docs/docs.css equal those of the viewer, in the
 * light and the dark scheme, so the docs and the viewer look like one product.
 * Tokens only the docs need live in a block of their own further down.
 */
export default function tokens(context) {
  const viewer = tokenBlocks(readFileSync(join(context.root, VIEWER_CSS), 'utf8'))
  const docs = tokenBlocks(readFileSync(join(context.root, DOCS_CSS), 'utf8'))
  const problems = []

  for (const scheme of ['light', 'dark']) {
    if (!viewer[scheme] || !docs[scheme]) {
      problems.push(`${DOCS_CSS}: cannot find the ${scheme} :root tokens here or in ${VIEWER_CSS}`)

      continue
    }

    problems.push(...compare(scheme, viewer[scheme], docs[scheme]))
  }

  return problems
}

function tokenBlocks(css) {
  const text = css.replace(COMMENT, '')

  return { light: declarations(text.match(LIGHT)), dark: declarations(text.match(DARK)) }
}

function declarations(block) {
  if (!block) {
    return null
  }

  return new Map(
    [...block[1].matchAll(DECLARATION)].map((match) => [
      match[1],
      match[2].replace(/\s+/g, ' ').trim(),
    ]),
  )
}

function compare(scheme, viewer, docs) {
  const problems = []

  for (const [name, value] of viewer) {
    if (!docs.has(name)) {
      problems.push(
        `${DOCS_CSS}: ${name} is missing from the ${scheme} tokens, ${VIEWER_CSS} has ${value}`,
      )
    } else if (docs.get(name) !== value) {
      problems.push(
        `${DOCS_CSS}: ${name} is ${docs.get(name)} in the ${scheme} scheme, ${VIEWER_CSS} has ${value}`,
      )
    }
  }

  for (const name of docs.keys()) {
    if (!viewer.has(name)) {
      problems.push(
        `${DOCS_CSS}: ${name} is in the copied ${scheme} tokens but not in ${VIEWER_CSS}. Docs-only tokens go in their own block`,
      )
    }
  }

  return problems
}
