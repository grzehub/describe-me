/**
 * Keeps the docs site in docs/ in step with the plan and the code. Each file
 * in scripts/check-docs/ is one check. Together they guarantee:
 *
 * - The pages are exactly those of scripts/docs/pages.mjs. Each has the head
 *   of the template, no scripts, inline styles or iframes, and only relative
 *   URLs for the site's own files. External links use https: or mailto:.
 * - The topbar is the same on every page and shows the version of the
 *   packages, which all four share. The sidebar is the same on every page
 *   apart from `aria-current="page"` on the page itself, and lists the pages
 *   in order and in their groups. The pager walks that order, and the footer
 *   links to the page's source on GitHub.
 * - Every `h2` has an id and an anchor link, the "On this page" list links
 *   them in order, and every id of scripts/docs/sections.mjs exists. Ids are
 *   unique per page. No page has `data-stub` or a `.stub`.
 * - The tokens at the top of docs/docs.css equal those of the viewer's
 *   stylesheet, in both colour schemes.
 * - Every relative link points at a page, a file of docs/ or an example
 *   viewer, and every fragment at an id of its target. Deep links into the
 *   examples name a test, frame and suite of that example's manifest, so run
 *   both examples' tests first.
 * - Code samples import only entry points the packages export, in every form
 *   of import, and only names those entry points export. `describe-me` is the
 *   CLI and exports nothing, so any import of it fails. A quoted
 *   `@describe-me/…` specifier outside an import, such as a `setupFiles`
 *   entry, names an entry point too. Package globs, prefixes and versions are
 *   not specifiers and pass.
 * - The root README and the package READMEs link only pages, ids and example
 *   viewers of the site that exist. A package README links docs pages, not
 *   anchors of the root README. The root README keeps the heading that the
 *   READMEs on npm link, and its "Documentation" section links every page.
 *
 * Usage: `node scripts/check-docs.mjs`
 */
import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { anchorsIn } from './docs/anchors-in.mjs'
import { attributeValues } from './docs/attribute-values.mjs'
import { codeBlocks } from './docs/code-blocks.mjs'
import { decodeEntities } from './docs/decode-entities.mjs'
import { exampleManifests } from './docs/example-manifests.mjs'
import { idsIn } from './docs/ids-in.mjs'
import { pagePart } from './docs/page-part.mjs'
import { pages } from './docs/pages.mjs'
import { publishedPackages } from './docs/published-packages.mjs'
import { readPage } from './docs/read-page.mjs'
import { repoRoot } from './docs/repo-root.mjs'
import { sections } from './docs/sections.mjs'
import { shownTests } from './docs/shown-tests.mjs'
import { startTags } from './docs/start-tags.mjs'
import { stripTags } from './docs/strip-tags.mjs'
import { versionSpan } from './docs/version-span.mjs'

const CHECKS_DIR = join(repoRoot, 'scripts', 'check-docs')
const DEEP_LINK = /^examples\/[^/]+\/(?:index\.html)?#./

const html = new Map()

for (const page of pages) {
  const text = readPage(page.file)

  if (text !== null) {
    html.set(page.file, text)
  }
}

const context = {
  root: repoRoot,
  pages,
  sections,
  html,
  helpers: {
    anchorsIn,
    attributeValues,
    codeBlocks,
    decodeEntities,
    idsIn,
    pagePart,
    readPage,
    shownTests,
    startTags,
    stripTags,
    versionSpan,
  },
  manifests: exampleManifests(),
  packages: publishedPackages(),
}

const checkFiles = readdirSync(CHECKS_DIR)
  .filter((file) => file.endsWith('.mjs'))
  .sort()

let failed = 0

for (const file of checkFiles) {
  const check = (await import(pathToFileURL(join(CHECKS_DIR, file)).href)).default
  const problems = await check(context)

  for (const problem of problems) {
    console.error(`check-docs: ${basename(file, '.mjs')}: ${problem}`)
  }

  failed += problems.length
}

if (failed > 0) {
  console.error(`check-docs: ${failed} problem${failed === 1 ? '' : 's'}`)
  process.exit(1)
}

const links = [...html.values()].flatMap((text) => [
  ...attributeValues(text, 'href'),
  ...attributeValues(text, 'src'),
])

const deepLinks = links.filter((link) => DEEP_LINK.test(decodeEntities(link)))
const samples = [...html.values()].flatMap((text) => codeBlocks(text))

console.log(
  `check-docs: ok — ${html.size} pages, ${links.length} links, ${deepLinks.length} deep links, ${samples.length} code samples, ${checkFiles.length} checks`,
)
