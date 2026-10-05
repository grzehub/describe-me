/**
 * Prints the deep link into an example viewer that opens one test, for a docs
 * page: as a URL relative to the site root, and with `&amp;` for an `href`.
 * The test is found by its full name as in the manifest, for example
 * `Button > variants > renders primary by default`. `frame` counts from 0.
 * Needs that example's manifest, so run its tests first.
 *
 * Usage: `node scripts/docs-link.mjs <react-browser|react-jsdom> "<full test name>" [frame]`
 */
import { exampleManifests } from './docs/example-manifests.mjs'
import { exampleNames } from './docs/example-names.mjs'
import { shownTests } from './docs/shown-tests.mjs'

const MAX_SUGGESTIONS = 10

function stop(message) {
  console.error(`docs:link: ${message}`)
  process.exit(1)
}

const [example, fullName, frameText] = process.argv.slice(2)

if (!exampleNames.includes(example) || !fullName) {
  stop(`usage: pnpm docs:link <${exampleNames.join('|')}> "<full test name>" [frame]`)
}

const manifest = exampleManifests()[example]

if (manifest === null) {
  stop(
    `examples/${example}/.describe-me/manifest.json is missing. Run pnpm --filter ${example} test first`,
  )
}

const tests = shownTests(manifest)
const matches = tests.filter((test) => test.fullName === fullName)

if (matches.length === 0) {
  const needle = fullName.toLowerCase()
  const similar = tests
    .filter((test) => test.fullName.toLowerCase().includes(needle))
    .slice(0, MAX_SUGGESTIONS)

  if (similar.length === 0) {
    stop(`no test in examples/${example} is named "${fullName}" or has it in its name`)
  }

  console.error(
    `docs:link: no test in examples/${example} is named "${fullName}". Names that contain it:`,
  )

  for (const test of similar) {
    console.error(`  ${test.fullName}`)
  }

  process.exit(1)
}

for (const test of matches) {
  const params = new URLSearchParams({ test: test.id })

  if (frameText !== undefined) {
    const frame = /^\d+$/.test(frameText) ? Number(frameText) : -1

    if (frame < 0 || frame >= test.frames.length) {
      stop(
        `"${test.fullName}" has ${test.frames.length} frames, so frame is 0 to ${test.frames.length - 1}`,
      )
    }

    params.set('frame', String(frame))
  }

  const link = `examples/${example}/#${params}`

  if (matches.length > 1) {
    console.log(`${test.moduleId}:`)
  }

  console.log(link)
  console.log(link.replaceAll('&', '&amp;'))
}
