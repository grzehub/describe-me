import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VIEWER_CSS = 'packages/viewer/src/style.css'
const DOCS_CSS = 'docs/docs.css'
const VIEWER_ICON = 'packages/viewer/src/favicon.svg'
const DOCS_ICON = 'docs/favicon.svg'
const COMMENT = /\/\*[\s\S]*?\*\//g
const LIGHT = /:root\s*\{([^}]*)\}/
const DARK = /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}/
const DARK_THEME = /:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/
const DARK_SYSTEM =
  /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root:not\(\[data-theme=['"]light['"]\]\)\s*\{([^}]*)\}/

const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g

/**
 * The viewer's two dark blocks, for the dark theme and for `system` on a dark
 * system, hold the same tokens. The tokens at the top of docs/docs.css equal
 * those of the viewer, in the light and the dark scheme, so the docs and the
 * viewer look like one product. Tokens only the docs need live in a block of
 * their own further down. The favicon, which is also the sygnet of the
 * wordmark, is the same file in both.
 */
export default function tokens(context) {
  const viewer = viewerBlocks(readFileSync(join(context.root, VIEWER_CSS), 'utf8'))
  const docs = docsBlocks(readFileSync(join(context.root, DOCS_CSS), 'utf8'))
  const problems = [...viewer.problems, ...favicons(context)]

  for (const scheme of ['light', 'dark']) {
    if (!viewer[scheme] || !docs[scheme]) {
      problems.push(`${DOCS_CSS}: cannot find the ${scheme} :root tokens here or in ${VIEWER_CSS}`)

      continue
    }

    problems.push(...compare(scheme, viewer[scheme], docs[scheme]))
  }

  return problems
}

function favicons(context) {
  const viewer = readFileSync(join(context.root, VIEWER_ICON), 'utf8')
  const docs = readFileSync(join(context.root, DOCS_ICON), 'utf8')

  return viewer === docs
    ? []
    : [`${DOCS_ICON}: differs from ${VIEWER_ICON}, copy one over the other`]
}

function docsBlocks(css) {
  const text = css.replace(COMMENT, '')

  return { light: declarations(text.match(LIGHT)), dark: declarations(text.match(DARK)) }
}

/** The light block and the dark theme's block, with problems where the two dark blocks differ. */
function viewerBlocks(css) {
  const text = css.replace(COMMENT, '')
  const theme = declarations(text.match(DARK_THEME))
  const system = declarations(text.match(DARK_SYSTEM))
  const problems = []

  if (!theme) {
    problems.push(`${VIEWER_CSS}: cannot find the :root[data-theme='dark'] tokens`)
  }

  if (!system) {
    problems.push(
      `${VIEWER_CSS}: cannot find the :root:not([data-theme='light']) tokens in @media (prefers-color-scheme: dark)`,
    )
  }

  if (theme && system) {
    problems.push(...compareDark(theme, system))
  }

  return { light: declarations(text.match(LIGHT)), dark: theme, problems }
}

function compareDark(theme, system) {
  const problems = []

  for (const name of new Set([...theme.keys(), ...system.keys()])) {
    const themeValue = theme.get(name) ?? 'nothing'
    const systemValue = system.get(name) ?? 'nothing'

    if (themeValue !== systemValue) {
      problems.push(
        `${VIEWER_CSS}: ${name} is ${themeValue} in :root[data-theme='dark'] and ${systemValue} in :root:not([data-theme='light']) of the dark media query`,
      )
    }
  }

  return problems
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
