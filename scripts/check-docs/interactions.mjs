import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = 'writing-stories.html'
const SECTION = 'frames'

const METHOD_LISTS = [
  { file: 'packages/vitest/src/patch-locators.ts', constant: 'ACTION_METHODS' },
  { file: 'packages/vitest/src/patch-user-event.ts', constant: 'KEYBOARD_METHODS' },
  { file: 'packages/vitest/src/patch-testing-library-user-event.ts', constant: 'METHODS' },
]

// From packages/react/src and packages/core/src/step.ts, which have no method list to read.
const ADAPTER_CALLS = {
  source: 'packages/react/src, packages/core/src/step.ts',
  names: ['render', 'rerender', 'fireEvent', 'step'],
}

/**
 * writing-stories.html#frames names, in a `<code>` element, every call that
 * records a frame: each method the patch files of packages/vitest intercept,
 * read from their method lists, plus `render`, `rerender`, `fireEvent` and
 * `step`. A method list that cannot be read or is empty is a problem too, so
 * the check never passes on nothing.
 */
export default function interactions(context) {
  const lists = METHOD_LISTS.map((list) => readMethodList(context.root, list))
  const problems = lists.filter((list) => list.problem).map((list) => list.problem)
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [...problems, `${PAGE}: the page is missing, so #${SECTION} cannot be checked`]
  }

  const main = context.helpers.pagePart(html, 'main') ?? ''
  const section = sectionOf(main, SECTION, context.helpers)

  if (section === null) {
    return [...problems, `${PAGE}: has no h2 #${SECTION} to name the calls that record a frame`]
  }

  const codeTexts = codeTextsOf(section, context.helpers)
  const sources = [...lists.filter((list) => !list.problem), ADAPTER_CALLS]
  const checked = new Set()

  for (const { source, names } of sources) {
    for (const name of names) {
      if (checked.has(name)) {
        continue
      }

      checked.add(name)

      if (!codeTexts.some((text) => holdsIdentifier(text, name))) {
        problems.push(`${PAGE}: #${SECTION} names no ${name} in <code> (${source})`)
      }
    }
  }

  return problems
}

/** The quoted strings of `const <constant> = [ … ] as const` in one source file. */
function readMethodList(root, { file, constant }) {
  const unreadable = { problem: `${PAGE}: cannot read ${constant} from ${file}` }
  let text

  try {
    text = readFileSync(join(root, file), 'utf8')
  } catch {
    return unreadable
  }

  const array = new RegExp(`const ${constant} = \\[([^\\]]*)\\] as const`).exec(text)

  if (!array) {
    return unreadable
  }

  const names = [...array[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((match) => match[1] ?? match[2])

  if (names.length === 0) {
    return { problem: `${PAGE}: ${constant} in ${file} is empty` }
  }

  return { source: file, names }
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

/** The text of every `<code>` element, tags stripped and entities decoded. */
function codeTextsOf(section, helpers) {
  return helpers
    .startTags(section)
    .filter((tag) => tag.name === 'code')
    .map((tag) => {
      const close = section.indexOf('</code', tag.end)
      const inner = section.slice(tag.end, close < 0 ? section.length : close)

      return helpers.decodeEntities(helpers.stripTags(inner))
    })
}

/** Whole identifiers only, so `click` does not count inside `dblClick`. */
function holdsIdentifier(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return new RegExp(`(?<![\\w$])${escaped}(?![\\w$])`).test(text)
}
