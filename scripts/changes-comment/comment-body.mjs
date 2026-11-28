import { hasChanges } from './has-changes.mjs'
import { shownImages } from './shown-images.mjs'

const MARKER = '<!-- describe-me:changes -->'
const MARKER_LINES = `${MARKER}\n\n`
const NOTHING_CHANGED = `${MARKER_LINES}Nothing renders differently against the base any more.\n`
/** GitHub's limit, which applies after gh swaps each image path for an attachment URL. */
const COMMENT_LIMIT = 65_536
/** An attachment URL has 79 characters, so this leaves room for a longer one. */
const IMAGE_ROOM = 100

function introText(changed, total, runUrl) {
  const first = `\`describe-me diff --shots\` against the base of this pull request: ${changed} of ${total} examples changed.`

  if (runUrl === undefined) {
    return first
  }

  return `${first} [The run](${runUrl}) has the whole report as an artifact.`
}

/** Every example's body ends with a newline, so the join leaves one blank line before each heading. */
function assembled(intro, examples, bodies) {
  const sections = examples.map((example, i) => `## examples/${example.name}\n\n${bodies[i]}`)

  return `${MARKER_LINES}${intro}\n\n${sections.join('\n')}`
}

function cost(body, example) {
  return body.length + IMAGE_ROOM * shownImages(body, example.images).length
}

/** `changesMarkdown` within `limit` characters for the body alone, without its marker line. */
function exampleBody(changesMarkdown, example, limit) {
  const markdown = changesMarkdown(example.report, limit + MARKER_LINES.length)

  if (!markdown.startsWith(MARKER_LINES)) {
    throw new Error(`the changes.md of ${example.name} does not start with ${MARKER}`)
  }

  return markdown.slice(MARKER_LINES.length)
}

/**
 * Each example gets an equal share of `room`. One that needs less keeps its
 * whole body, and the ones after it split what it leaves. A share reserves
 * room for every image of its report, so the images it shows always fit.
 */
function sharedBodies(examples, full, room, changesMarkdown) {
  const bodies = [...full]
  const order = examples
    .map((_, i) => i)
    .sort((left, right) => cost(full[left], examples[left]) - cost(full[right], examples[right]))

  let left = room
  let count = examples.length

  for (const i of order) {
    const share = Math.floor(left / count)
    const example = examples[i]

    if (cost(full[i], example) > share) {
      bodies[i] = exampleBody(changesMarkdown, example, share - IMAGE_ROOM * example.images.length)
    }

    left -= cost(bodies[i], example)
    count--
  }

  return bodies
}

/**
 * The comment for the reports of several examples: the marker, a sentence on
 * how many changed, then a `##` section per example with the body of its
 * `changes.md`. It stays within GitHub's limit once gh has swapped every image
 * path for an attachment URL. When no report has a change, it is one sentence.
 */
export function commentBody({ examples, runUrl, changesMarkdown }) {
  const changed = examples.filter((example) => hasChanges(example.report)).length

  if (changed === 0) {
    return NOTHING_CHANGED
  }

  const intro = introText(changed, examples.length, runUrl)
  const full = examples.map((example) =>
    exampleBody(changesMarkdown, example, COMMENT_LIMIT - MARKER_LINES.length),
  )

  const frame = assembled(
    intro,
    examples,
    examples.map(() => ''),
  ).length

  const total = (bodies) =>
    frame + bodies.reduce((sum, body, i) => sum + cost(body, examples[i]), 0)

  if (total(full) <= COMMENT_LIMIT) {
    return assembled(intro, examples, full)
  }

  const bodies = sharedBodies(examples, full, COMMENT_LIMIT - frame, changesMarkdown)

  if (total(bodies) > COMMENT_LIMIT) {
    throw new Error(
      `even with every list cut, the comment needs ${total(bodies)} characters, more than GitHub's limit of ${COMMENT_LIMIT}`,
    )
  }

  return assembled(intro, examples, bodies)
}
