import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exampleNames } from '../docs/example-names.mjs'

const ROOT_README = 'README.md'
const SITE_ORIGIN = 'https://grzehub.github.io'
const SITE_PATH = '/describe-me/'
const REPO_ORIGIN = 'https://github.com'
const REPO_PATH = '/grzehub/describe-me'
const NPM_HEADING = '## Add it to your project'
const NPM_ANCHOR = '#add-it-to-your-project'
const PAGE_LIST_HEADING = '## Documentation'
const URL_PATTERN = /https:\/\/[^\s)\]>"'`]+/g
// Prose may end a sentence right after a bare URL.
const TRAILING_PUNCTUATION = /[.,:;!?]+$/

/**
 * The docs links in the root README and the package READMEs resolve. A site
 * URL points at the site root, a page with an id of that page, or an example
 * viewer without a fragment. A package README links docs pages, never anchors
 * of the root README on GitHub. The root README keeps the heading that the
 * READMEs on npm link, and its "Documentation" section links every page.
 */
export default function readmeLinks(context) {
  const files = [ROOT_README, ...context.packages.map((pkg) => `${pkg.dir}/README.md`)]
  const problems = []

  for (const file of files) {
    const path = join(context.root, file)

    if (!existsSync(path)) {
      problems.push(`${file}: missing`)

      continue
    }

    const text = readFileSync(path, 'utf8')
    const links = linksIn(file, text, problems)

    problems.push(...links.flatMap((link) => siteProblems(file, link, context)))

    if (file === ROOT_README) {
      problems.push(...rootProblems(text, context))
    } else {
      problems.push(...links.flatMap((link) => repoAnchorProblems(file, link)))
    }
  }

  return problems
}

/** Every `https:` URL of the text, parsed, with the text it was written as. */
function linksIn(file, text, problems) {
  const links = []

  for (const match of text.matchAll(URL_PATTERN)) {
    const written = match[0].replace(TRAILING_PUNCTUATION, '')

    try {
      links.push({ written, url: new URL(written) })
    } catch {
      problems.push(`${file}: ${written}: not a valid URL`)
    }
  }

  return links
}

function isSiteUrl(url) {
  return url.origin === SITE_ORIGIN && url.pathname.startsWith(SITE_PATH)
}

/** The page of the site a URL opens, `index.html` for the site root, or `null`. */
function pageOf(url, context) {
  const rest = url.pathname.slice(SITE_PATH.length)
  const file = rest === '' ? 'index.html' : rest

  return context.pages.some((page) => page.file === file) ? file : null
}

function viewerOf(url) {
  const rest = url.pathname.slice(SITE_PATH.length)

  return exampleNames.find((name) => rest === `examples/${name}/`) ?? null
}

function siteProblems(file, link, context) {
  if (!isSiteUrl(link.url)) {
    return []
  }

  const where = `${file}: ${link.written}`

  if (viewerOf(link.url) !== null) {
    return link.url.hash === '' ? [] : [`${where}: READMEs link docs pages, not deep links`]
  }

  const page = pageOf(link.url, context)

  if (page === null) {
    return [
      `${where}: points at nothing on the site (the root, a page of scripts/docs/pages.mjs or examples/<name>/)`,
    ]
  }

  if (link.url.hash === '') {
    return []
  }

  const id = safeDecode(link.url.hash.slice(1))
  const ids = context.helpers.idsIn(context.html.get(page) ?? '')

  return ids.includes(id) ? [] : [`${where}: ${page} has no id "${id}"`]
}

function repoAnchorProblems(file, link) {
  const { url } = link

  if (url.origin !== REPO_ORIGIN || url.pathname !== REPO_PATH || url.hash === '') {
    return []
  }

  return [`${file}: ${link.written}: an anchor of the root README, link the docs page instead`]
}

function rootProblems(text, context) {
  const problems = []
  const lines = text.split('\n').map((line) => line.trim())

  if (!lines.includes(NPM_HEADING)) {
    problems.push(`${ROOT_README}: has no "${NPM_HEADING}". The READMEs on npm link ${NPM_ANCHOR}`)
  }

  const start = lines.indexOf(PAGE_LIST_HEADING)

  if (start < 0) {
    return [...problems, `${ROOT_README}: has no "${PAGE_LIST_HEADING}" that lists the pages`]
  }

  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const section = lines.slice(start, end < 0 ? lines.length : end).join('\n')
  const linked = new Set(
    linksIn(ROOT_README, section, [])
      .filter((link) => isSiteUrl(link.url))
      .map((link) => pageOf(link.url, context)),
  )

  for (const page of context.pages) {
    if (!linked.has(page.file)) {
      problems.push(
        `${ROOT_README}: "${PAGE_LIST_HEADING}" does not link ${page.file} with a site URL`,
      )
    }
  }

  return problems
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
