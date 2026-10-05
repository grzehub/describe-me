import { exampleNames } from '../docs/example-names.mjs'

const PAGE = 'examples.html'
const OPEN = 'open'

/**
 * examples.html opens both example viewers from viewer cards in #open, and
 * each example's section names every component of that example's manifest in
 * a `<code>` element, so the walk through an example cannot leave a component
 * out. Needs both examples' manifests, so run their tests first.
 */
export default function examples(context) {
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [`${PAGE}: the page is missing, so the examples cannot be checked`]
  }

  const main = context.helpers.pagePart(html, 'main') ?? ''
  const open = sectionOf(main, OPEN, context.helpers)
  const problems = []

  for (const name of exampleNames) {
    if (!hasViewerCard(open ?? '', name, context.helpers)) {
      problems.push(`${PAGE}: #${OPEN} has no a.card.viewer linking examples/${name}/`)
    }

    problems.push(...componentProblems(main, name, context))
  }

  return problems
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

function hasViewerCard(section, name, helpers) {
  return helpers.startTags(section).some((tag) => {
    const classes = (tag.attributes.class ?? '').split(/\s+/)

    return (
      tag.name === 'a' &&
      classes.includes('card') &&
      classes.includes('viewer') &&
      tag.attributes.href === `examples/${name}/`
    )
  })
}

function componentProblems(main, name, context) {
  const manifest = context.manifests[name]

  if (manifest === null) {
    return [
      `${PAGE}: examples/${name}/.describe-me/manifest.json is missing. Run pnpm --filter ${name} test first`,
    ]
  }

  const components = Object.keys(manifest.components ?? {})

  if (components.length === 0) {
    return [
      `${PAGE}: examples/${name}/.describe-me/manifest.json documents no components, so #${name} cannot be checked`,
    ]
  }

  const section = sectionOf(main, name, context.helpers)

  if (section === null) {
    return [`${PAGE}: has no h2 #${name} to name the components of the ${name} manifest`]
  }

  const named = new Set(codeTexts(section, context.helpers))

  return components
    .filter((component) => !named.has(component))
    .map(
      (component) =>
        `${PAGE}: the ${name} manifest documents ${component}, but #${name} names it nowhere in <code>`,
    )
}

/** The text of every `<code>` element, tags stripped, entities decoded and trimmed. */
function codeTexts(section, helpers) {
  return helpers
    .startTags(section)
    .filter((tag) => tag.name === 'code')
    .map((tag) => {
      const close = section.indexOf('</code', tag.end)
      const inner = section.slice(tag.end, close < 0 ? section.length : close)

      return helpers.decodeEntities(helpers.stripTags(inner)).trim()
    })
}
