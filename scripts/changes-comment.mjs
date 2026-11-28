/**
 * Merges the `describe-me diff --out` directories of the four examples into
 * the body of one pull request comment, which `.github/workflows/changes.yml`
 * posts. `<dir>` holds `react-browser/`, `react-jsdom/`, `shadcn/` and `mui/`.
 * It recreates `<dir>/comment/` with `changes.md` and the images that body
 * shows, each renamed to `<example>-<file>`. When `GITHUB_OUTPUT` is set, it
 * appends `changed=true` or `changed=false` to it.
 *
 * Run after `pnpm build`. Exits 1 without writing anything when a report is
 * missing or cannot be read, an image is missing, or the body shows more
 * than the 50 images gh attaches to one comment.
 *
 * Usage: `node scripts/changes-comment.mjs <dir> [--run-url <url>]`
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { commentBody } from './changes-comment/comment-body.mjs'
import { hasChanges } from './changes-comment/has-changes.mjs'
import { readExampleReport } from './changes-comment/read-example-report.mjs'
import { renamedShots } from './changes-comment/renamed-shots.mjs'
import { shownImages } from './changes-comment/shown-images.mjs'
import { repoRoot } from './docs/repo-root.mjs'

const EXAMPLES = ['react-browser', 'react-jsdom', 'shadcn', 'mui']
const USAGE = 'Usage: pnpm changes-comment <dir> [--run-url <url>]'
/** gh attaches up to 50 files per call. */
const MAX_IMAGES = 50
const MARKDOWN_MODULE = join(repoRoot, 'packages/viewer/dist-cli/changes-markdown.js')

function fail(message) {
  console.error(`changes-comment: ${message}`)
  process.exit(1)
}

function parsedArgs() {
  try {
    return parseArgs({ allowPositionals: true, options: { 'run-url': { type: 'string' } } })
  } catch (error) {
    fail(`${error.message}\n${USAGE}`)
  }
}

const { values, positionals } = parsedArgs()

if (positionals.length !== 1) {
  fail(`needs one directory, the one that holds the four diff outputs\n${USAGE}`)
}

if (!existsSync(MARKDOWN_MODULE)) {
  fail('packages/viewer/dist-cli/changes-markdown.js is missing. Run pnpm build first.')
}

const { changesMarkdown } = await import(MARKDOWN_MODULE)
const dir = resolve(positionals[0])
let examples

try {
  examples = EXAMPLES.map((name) => ({
    name,
    ...renamedShots(readExampleReport(dir, name), name, dir),
  }))
} catch (error) {
  fail(error.message)
}

let body

try {
  body = commentBody({ examples, runUrl: values['run-url'], changesMarkdown })
} catch (error) {
  fail(error.message)
}

const images = examples.flatMap((example) => shownImages(body, example.images))
const changed = examples.filter((example) => hasChanges(example.report)).length

if (images.length > MAX_IMAGES) {
  fail(
    `the comment shows ${images.length} images, and gh attaches at most ${MAX_IMAGES} to one comment. Pass a smaller --max-shots to describe-me diff.`,
  )
}

const out = join(dir, 'comment')

rmSync(out, { recursive: true, force: true })
mkdirSync(out)
writeFileSync(join(out, 'changes.md'), body)

for (const image of images) {
  copyFileSync(image.source, join(out, image.file))
}

if (changed === 0) {
  console.log('Nothing changed in the four examples. Wrote comment/changes.md.')
} else {
  const written = images.length === 1 ? '1 image' : `${images.length} images`

  console.log(
    `${changed} of ${EXAMPLES.length} examples changed. Wrote comment/changes.md and ${written}.`,
  )
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed > 0}\n`)
}
